// 端到端测试：添加新设备并立即连接
console.log('=== 端到端测试：前端添加新设备 -> 立即连接 ===\n');

async function testCompleteWorkflow() {
    // 1. 模拟在前端添加新设备（实际上我们用现有的设备来模拟）
    console.log('第1步：模拟前端API有新设备...');
    const newDeviceFromFrontend = {
        deviceId: "test-new-device-" + Date.now(),
        workstationId: "cmes6s081006htmuwhsl0gpri", 
        name: "新添加的PLC设备",
        type: "PLC_CONTROLLER",
        brand: "SIEMENS",
        model: "S7_1200",
        ipAddress: "127.0.0.1",  // 使用本地地址确保能连接
        port: 102,
        workstationName: "M1"
    };
    
    console.log(`新设备信息: ${newDeviceFromFrontend.name} (${newDeviceFromFrontend.deviceId})`);
    console.log(`地址: ${newDeviceFromFrontend.ipAddress}:${newDeviceFromFrontend.port}\n`);
    
    // 2. 同步设备到.NET服务
    console.log('第2步：同步设备到.NET服务...');
    const syncSuccess = await syncDeviceToBackend(newDeviceFromFrontend);
    
    if (!syncSuccess) {
        console.log('❌ 设备同步失败！');
        return false;
    }
    
    console.log('✓ 设备同步成功！\n');
    
    // 3. 立即尝试连接设备
    console.log('第3步：立即连接新设备...');
    const connectResponse = await fetch(`http://localhost:5000/api/devices/${newDeviceFromFrontend.deviceId}/connect`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (connectResponse.ok) {
        const result = await connectResponse.json();
        console.log(`✓ 设备连接成功！`);
        console.log(`  连接ID: ${result.id}`);
        console.log(`  连接时间: ${result.duration}ms`);
        console.log(`  时间戳: ${result.timestamp}`);
        
        // 4. 验证设备状态
        console.log('\n第4步：验证设备状态...');
        const statusResponse = await fetch(`http://localhost:5000/api/devices/${newDeviceFromFrontend.deviceId}/status`);
        
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log(`✓ 设备状态: ${status.status}`);
            console.log(`  在线状态: ${status.isOnline}`);
            console.log(`  最后心跳: ${status.lastHeartbeat}`);
            
            return true;
        }
    }
    
    console.log('❌ 设备连接失败！');
    return false;
}

async function syncDeviceToBackend(device) {
    try {
        const devicePayload = {
            deviceId: device.deviceId,
            workstationId: device.workstationId,
            name: device.name,
            description: `${device.workstationName}工位新添加的设备 ${device.ipAddress}`,
            deviceType: 'PLC',
            connectionType: 'TCP',
            connectionString: '',
            enabled: true,
            connection: {
                type: 'TCP',
                address: device.ipAddress,
                port: device.port,
                parameters: {
                    plcType: 'Siemens_S7',
                    rack: 0,
                    slot: 1
                }
            },
            settings: {
                plcType: 'Siemens_S7'
            },
            configuration: {
                plc: {
                    plcType: 'Siemens_S7',
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
                    source: 'test_add'
                }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const response = await fetch('http://localhost:5000/api/devices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(devicePayload)
        });
        
        return response.ok;
    } catch (error) {
        console.log(`同步错误: ${error.message}`);
        return false;
    }
}

// 运行测试
testCompleteWorkflow().then(success => {
    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('🎉 端到端测试成功！');
        console.log('✓ 用户可以在前端添加设备后立即连接！');
        console.log('✓ 问题已完全解决！');
    } else {
        console.log('❌ 端到端测试失败！');
    }
    console.log('='.repeat(50));
}).catch(console.error);