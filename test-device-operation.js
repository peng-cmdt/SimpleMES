// 测试新的设备通信架构
// 运行: node test-device-operation.js

const fetch = require('node-fetch');

async function testDeviceOperation() {
  console.log('测试新的设备通信架构...\n');

  // 测试配置
  const testDevice = {
    id: 'device_plc_001',  // 数据库中的设备ID
    deviceId: 'PLC_001',   // 实际设备ID
    ipAddress: '192.168.1.100',
    port: 102,
    plcType: 'Siemens_S7'
  };

  // 测试用例1: 读取PLC数据
  console.log('1. 测试读取PLC数据');
  console.log('----------------------------------------');
  
  const readRequest = {
    deviceId: testDevice.id,
    deviceType: 'PLC',
    deviceInfo: {
      ipAddress: testDevice.ipAddress,
      port: testDevice.port,
      plcType: testDevice.plcType,
      protocol: 'TCP/IP'
    },
    operation: {
      type: 'DEVICE_READ',
      address: 'DB1.DBX0.0',
      dataType: 'BOOL'
    }
  };

  try {
    console.log('发送请求:');
    console.log(JSON.stringify(readRequest, null, 2));
    
    const response = await fetch('http://localhost:3009/api/device-operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(readRequest)
    });

    const result = await response.json();
    console.log('\n响应结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`✓ 读取成功: 值 = ${result.data?.value}`);
    } else {
      console.log(`✗ 读取失败: ${result.error}`);
    }
  } catch (error) {
    console.error('请求失败:', error.message);
  }

  // 测试用例2: 写入PLC数据
  console.log('\n\n2. 测试写入PLC数据');
  console.log('----------------------------------------');
  
  const writeRequest = {
    deviceId: testDevice.id,
    deviceType: 'PLC',
    deviceInfo: {
      ipAddress: testDevice.ipAddress,
      port: testDevice.port,
      plcType: testDevice.plcType,
      protocol: 'TCP/IP'
    },
    operation: {
      type: 'DEVICE_WRITE',
      address: 'DB1.DBX0.1',
      value: 1,
      dataType: 'BOOL'
    }
  };

  try {
    console.log('发送请求:');
    console.log(JSON.stringify(writeRequest, null, 2));
    
    const response = await fetch('http://localhost:3009/api/device-operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(writeRequest)
    });

    const result = await response.json();
    console.log('\n响应结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✓ 写入成功');
    } else {
      console.log(`✗ 写入失败: ${result.error}`);
    }
  } catch (error) {
    console.error('请求失败:', error.message);
  }

  // 测试用例3: 使用Action执行设备操作
  console.log('\n\n3. 测试通过Action执行设备操作');
  console.log('----------------------------------------');
  
  const actionRequest = {
    actionId: 'action_001',
    actionType: 'DEVICE_READ',
    deviceId: testDevice.id,
    actionData: {
      address: 'DB1.DBX0.2',
      orderStepId: 'step_001'
    }
  };

  try {
    console.log('发送请求:');
    console.log(JSON.stringify(actionRequest, null, 2));
    
    const response = await fetch('http://localhost:3009/api/device-operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(actionRequest)
    });

    const result = await response.json();
    console.log('\n响应结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`✓ Action执行成功: 值 = ${result.data?.value}`);
    } else {
      console.log(`✗ Action执行失败: ${result.error}`);
    }
  } catch (error) {
    console.error('请求失败:', error.message);
  }

  // 测试用例4: 测试三菱PLC
  console.log('\n\n4. 测试三菱PLC通信');
  console.log('----------------------------------------');
  
  const mitsubishiRequest = {
    deviceId: 'device_plc_002',
    deviceType: 'PLC',
    deviceInfo: {
      ipAddress: '192.168.1.101',
      port: 6000,
      plcType: 'Mitsubishi_MC',
      protocol: 'TCP/IP'
    },
    operation: {
      type: 'DEVICE_READ',
      address: 'D100',
      dataType: 'WORD'
    }
  };

  try {
    console.log('发送请求:');
    console.log(JSON.stringify(mitsubishiRequest, null, 2));
    
    const response = await fetch('http://localhost:3009/api/device-operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mitsubishiRequest)
    });

    const result = await response.json();
    console.log('\n响应结果:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log(`✓ 三菱PLC读取成功: 值 = ${result.data?.value}`);
    } else {
      console.log(`✗ 三菱PLC读取失败: ${result.error}`);
    }
  } catch (error) {
    console.error('请求失败:', error.message);
  }

  console.log('\n\n测试完成！');
}

// 检查前端服务是否运行
async function checkServices() {
  console.log('检查服务状态...\n');
  
  // 检查前端服务
  try {
    const frontendResponse = await fetch('http://localhost:3009/api/devices');
    if (frontendResponse.ok) {
      console.log('✓ 前端服务正在运行 (端口 3009)');
    }
  } catch (error) {
    console.error('✗ 前端服务未运行，请先启动: cd simple-mes && npm run dev -- --port 3009');
    process.exit(1);
  }

  // 检查.NET后端服务
  try {
    const backendResponse = await fetch('http://localhost:5000/api/health');
    if (backendResponse.ok) {
      console.log('✓ .NET设备通信服务正在运行 (端口 5000)');
    }
  } catch (error) {
    console.error('✗ .NET设备通信服务未运行，请先启动: cd DeviceCommunicationService/DeviceCommunicationService && dotnet run');
    console.log('\n提示: 请确保两个服务都在运行后再执行测试');
    process.exit(1);
  }

  console.log('\n服务检查通过，开始测试...\n');
}

// 主函数
async function main() {
  await checkServices();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testDeviceOperation();
}

main().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});