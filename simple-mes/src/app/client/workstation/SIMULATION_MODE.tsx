// 模拟模式配置 - 立即可用
export const SIMULATION_CONFIG = {
  enabled: true,  // 设置为true启用模拟模式
  
  // 模拟设备数据
  simulatedDevices: {
    'cmfarf98z0005tme429z87fhs': {  // PLC_1200
      name: 'PLC_1200 (模拟)',
      ipAddress: '127.0.0.1',
      port: 5020,
      status: 'ONLINE',
      isOnline: true,
      simulatedData: {
        'DB1.DBW0': { value: 1234, type: 'INT' },
        'M0.0': { value: true, type: 'BOOL' },
        'M0.1': { value: false, type: 'BOOL' },
        'DB10.DBD0': { value: 5678.9, type: 'REAL' }
      }
    },
    'cmfargmpe0009tme4c78fmxdh': {  // PLC_1500
      name: 'PLC_1500 (模拟)',
      ipAddress: '127.0.0.1', 
      port: 5021,
      status: 'ONLINE',
      isOnline: true,
      simulatedData: {
        'DB2.DBW0': { value: 9876, type: 'INT' },
        'M1.0': { value: false, type: 'BOOL' },
        'M1.1': { value: true, type: 'BOOL' },
        'DB20.DBD0': { value: 1234.5, type: 'REAL' }
      }
    }
  },
  
  // 模拟响应延迟
  responseDelay: 500, // 毫秒
  
  // 模拟连接测试
  simulateConnectionTest: true,
  
  // 错误模拟（用于测试错误处理）
  simulateErrors: false  // 设置为true可以测试错误处理
};

// 模拟设备连接
export async function simulateDeviceConnection(deviceId: string) {
  await new Promise(resolve => setTimeout(resolve, SIMULATION_CONFIG.responseDelay));
  
  const device = SIMULATION_CONFIG.simulatedDevices[deviceId];
  if (!device) {
    return {
      success: false,
      error: `模拟设备 ${deviceId} 未找到`
    };
  }
  
  if (SIMULATION_CONFIG.simulateErrors && Math.random() > 0.8) {
    return {
      success: false,
      error: '模拟连接失败 - 网络超时'
    };
  }
  
  return {
    success: true,
    message: `设备 ${device.name} 连接成功（模拟模式）`,
    data: {
      deviceId,
      deviceName: device.name,
      ipAddress: device.ipAddress,
      port: device.port,
      status: 'CONNECTED',
      isOnline: true,
      mode: 'simulation'
    }
  };
}

// 模拟设备读取
export async function simulateDeviceRead(deviceId: string, address: string) {
  await new Promise(resolve => setTimeout(resolve, SIMULATION_CONFIG.responseDelay));
  
  const device = SIMULATION_CONFIG.simulatedDevices[deviceId];
  if (!device) {
    throw new Error(`模拟设备 ${deviceId} 未找到`);
  }
  
  const data = device.simulatedData[address];
  if (!data) {
    // 如果没有预设数据，生成随机数据
    return {
      address,
      value: generateRandomValue(address),
      type: inferDataType(address),
      timestamp: new Date().toISOString(),
      mode: 'simulation'
    };
  }
  
  return {
    address,
    value: data.value,
    type: data.type,
    timestamp: new Date().toISOString(),
    mode: 'simulation'
  };
}

// 模拟设备写入
export async function simulateDeviceWrite(deviceId: string, address: string, value: any) {
  await new Promise(resolve => setTimeout(resolve, SIMULATION_CONFIG.responseDelay));
  
  const device = SIMULATION_CONFIG.simulatedDevices[deviceId];
  if (!device) {
    throw new Error(`模拟设备 ${deviceId} 未找到`);
  }
  
  return {
    address,
    value,
    status: 'SUCCESS',
    message: `写入成功（模拟模式）`,
    timestamp: new Date().toISOString(),
    mode: 'simulation'
  };
}

// 生成随机数据
function generateRandomValue(address: string): any {
  if (address.includes('BOOL')) return Math.random() > 0.5;
  if (address.includes('INT')) return Math.floor(Math.random() * 1000);
  if (address.includes('REAL')) return Math.round(Math.random() * 1000 * 100) / 100;
  if (address.includes('STRING')) return `Simulated_${address}`;
  return Math.floor(Math.random() * 100);
}

// 推断数据类型
function inferDataType(address: string): string {
  if (address.includes('DBX') || address.includes('M')) return 'BOOL';
  if (address.includes('DBD') || address.includes('REAL')) return 'REAL';
  if (address.includes('DBW') || address.includes('INT')) return 'INT';
  if (address.includes('STRING')) return 'STRING';
  return 'INT';
}