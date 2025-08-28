// 测试添加新设备到工位

const newDevice = {
  workstationId: "cmes6s081006htmuwhsl0gpri", // M1工位的ID
  templateId: "cmes7cc510000tm1oycoj6b13", // PLC_SIMENS_1200模板的ID
  displayName: "测试PLC设备2",
  ipAddress: "192.168.1.101",
  port: 102,
  protocol: "TCP",
  config: {
    plcType: "Siemens_S7",
    rack: 0,
    slot: 1
  },
  status: "OFFLINE"
};

async function testAddDevice() {
  console.log('开始测试添加新设备...');
  
  try {
    // 调用前端API添加设备
    const response = await fetch('http://localhost:3009/api/workstation-devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newDevice)
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✓ 设备添加成功：', result.data);
      console.log('设备ID：', result.data.id);
      console.log('显示名称：', result.data.displayName);
      
      // 等待2秒后检查设备状态
      setTimeout(async () => {
        console.log('\n检查设备是否在后端注册...');
        
        try {
          const statusResponse = await fetch(`http://localhost:3009/api/device-communication/devices/${result.data.id}/status`);
          const statusResult = await statusResponse.json();
          
          console.log('设备状态响应：', statusResult);
          
          if (statusResult.success) {
            console.log('✓ 设备已在后端注册');
            console.log('连接状态：', statusResult.data.isConnected ? '已连接' : '未连接');
          } else {
            console.log('✗ 设备未在后端找到');
          }
        } catch (error) {
          console.error('检查设备状态失败：', error.message);
        }
      }, 2000);
      
    } else {
      console.error('✗ 设备添加失败：', result.error || '未知错误');
    }
  } catch (error) {
    console.error('✗ 请求失败：', error.message);
  }
}

// 执行测试
testAddDevice();