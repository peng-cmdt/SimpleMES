// 手动同步脚本 - 绕过HTTP客户端问题
const fs = require('fs');

async function fetchFrontendDevices() {
    console.log('Fetching devices from frontend API...');
    
    try {
        const response = await fetch('http://localhost:3009/api/workstations', {
            method: 'GET',
            headers: {
                'User-Agent': 'DeviceSync/1.0'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.workstations) {
            const allDevices = [];
            
            for (const workstation of data.workstations) {
                if (workstation.devices) {
                    for (const device of workstation.devices) {
                        const deviceConfig = {
                            deviceId: device.deviceId,
                            workstationId: workstation.id,
                            name: device.name,
                            type: device.type,
                            brand: device.brand || '',
                            model: device.model || '',
                            ipAddress: device.ipAddress,
                            port: device.port,
                            status: device.status,
                            workstationName: workstation.name
                        };
                        allDevices.push(deviceConfig);
                    }
                }
            }
            
            console.log(`Found ${allDevices.length} devices across ${data.workstations.length} workstations:`);
            allDevices.forEach(device => {
                console.log(`  - ${device.name} (${device.deviceId}) at ${device.ipAddress}:${device.port}`);
            });
            
            return allDevices;
        }
        
        return [];
    } catch (error) {
        console.error('Failed to fetch devices:', error.message);
        return [];
    }
}

async function syncDeviceToBackend(device) {
    try {
        console.log(`Syncing device: ${device.name} (${device.deviceId})`);
        
        // 使用类似TestController的方法，直接调用DeviceManager
        const addDeviceUrl = `http://localhost:5000/api/devices/${device.deviceId}`;
        
        // 先检查设备是否已存在
        let existsResponse;
        try {
            existsResponse = await fetch(addDeviceUrl, { method: 'GET' });
        } catch (e) {
            existsResponse = { ok: false };
        }
        
        // 构造.NET服务期望的格式（基于TestController的成功模式）
        const devicePayload = {
            deviceId: device.deviceId,
            workstationId: device.workstationId,
            name: device.name,
            description: `${device.workstationName}工位${device.type}设备 ${device.ipAddress}`,
            deviceType: 'PLC',
            connectionType: 'TCP',
            connectionString: '',
            enabled: true,
            connection: {
                type: 'TCP',
                address: device.ipAddress,
                port: device.port,
                parameters: {
                    plcType: getPlcType(device.brand),
                    rack: 0,
                    slot: 1
                }
            },
            settings: {
                plcType: getPlcType(device.brand)
            },
            configuration: {
                plc: {
                    plcType: getPlcTypeEnum(device.brand),
                    slot: 1,
                    rack: 0,
                    station: 0,
                    cpu: 'S7_1200',
                    wordLength: 2,
                    isBit: false
                },
                additional: {
                    brand: device.brand,
                    model: device.model,
                    source: 'auto_sync'
                }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 使用PUT方法更新设备（如果存在）或使用特殊的sync端点
        const method = existsResponse.ok ? 'PUT' : 'POST';
        const url = existsResponse.ok ? addDeviceUrl : 'http://localhost:5000/api/devices';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'DeviceSync/1.0'
            },
            body: JSON.stringify(devicePayload)
        });

        if (response.ok) {
            console.log(`✓ Device ${device.name} synced successfully (${method})`);
            return true;
        } else {
            // 如果常规方法失败，尝试使用TestController风格的添加
            console.log(`Regular API failed, trying manual add for ${device.name}...`);
            return await addDeviceManually(device);
        }
    } catch (error) {
        console.log(`✗ Error syncing ${device.name}: ${error.message}`);
        // 尝试手动添加作为后备方案
        return await addDeviceManually(device);
    }
}

async function addDeviceManually(device) {
    try {
        // 使用类似TestController的手动添加方法
        const testUrl = `http://localhost:5000/api/Test/add-device-custom`;
        
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                deviceId: device.deviceId,
                name: device.name,
                address: device.ipAddress,
                port: device.port,
                brand: device.brand,
                workstationId: device.workstationId
            })
        });
        
        if (response.ok) {
            console.log(`✓ Device ${device.name} added manually`);
            return true;
        }
        
        console.log(`✗ Manual add failed for ${device.name}`);
        return false;
    } catch (error) {
        console.log(`✗ Manual add error for ${device.name}: ${error.message}`);
        return false;
    }
}

function getPlcTypeEnum(brand) {
    if (!brand) return 'Siemens_S7';
    
    switch (brand.toUpperCase()) {
        case 'SIEMENS': return 'Siemens_S7';
        case 'MITSUBISHI': return 'Mitsubishi_MC'; 
        case 'OMRON': return 'Omron_FINS';
        default: return 'Siemens_S7';
    }
}

function getPlcType(brand) {
    if (!brand) return 'Siemens_S7';
    
    switch (brand.toUpperCase()) {
        case 'SIEMENS': return 'Siemens_S7';
        case 'MITSUBISHI': return 'Mitsubishi_MC';
        case 'OMRON': return 'Omron_FINS';
        default: return 'Siemens_S7';
    }
}

async function main() {
    console.log('=== Device Configuration Sync Tool ===');
    console.log('This tool syncs devices from frontend to .NET service\n');
    
    // 1. 获取前端设备
    const devices = await fetchFrontendDevices();
    
    if (devices.length === 0) {
        console.log('No devices found to sync.');
        return;
    }
    
    console.log(`\nSyncing ${devices.length} devices to .NET service...\n`);
    
    // 2. 同步每个设备到后端
    let successCount = 0;
    let failCount = 0;
    
    for (const device of devices) {
        const success = await syncDeviceToBackend(device);
        if (success) {
            successCount++;
        } else {
            failCount++;
        }
        
        // 短暂延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n=== Sync Complete ===`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${devices.length}`);
    
    if (successCount > 0) {
        console.log('\n✓ Devices are now available for connection in client service mode!');
    }
}

// 运行同步
main().catch(console.error);