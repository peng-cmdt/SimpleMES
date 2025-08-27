// 测试订单API是否返回正确的Action-Device关联数据
async function testOrderAPI() {
  try {
    // 获取订单ID
    const ordersResponse = await fetch('http://localhost:3010/api/orders?limit=1');
    const ordersData = await ordersResponse.json();
    
    if (!ordersData.success || !ordersData.data.orders.length) {
      console.log('❌ 没有找到订单');
      return;
    }
    
    const orderId = ordersData.data.orders[0].id;
    console.log('✅ 找到订单ID:', orderId);
    
    // 获取订单详情
    const orderResponse = await fetch(`http://localhost:3010/api/orders/${orderId}`);
    const orderData = await orderResponse.json();
    
    if (!orderResponse.ok || !orderData.success) {
      console.log('❌ 获取订单详情失败:', orderData.error);
      return;
    }
    
    console.log('\n🔍 订单详情结构分析:');
    console.log('订单号:', orderData.data.orderNumber);
    console.log('产品:', orderData.data.product?.name);
    console.log('工艺:', orderData.data.process?.name);
    
    // 分析工艺步骤中的动作
    if (orderData.data.process?.steps) {
      console.log('\n📋 Process Steps 分析:');
      orderData.data.process.steps.forEach((step, index) => {
        console.log(`步骤 ${index + 1}: ${step.name}`);
        if (step.actions) {
          step.actions.forEach((action, actionIndex) => {
            console.log(`  动作 ${actionIndex + 1}: ${action.name}`);
            console.log(`    类型: ${action.type}`);
            console.log(`    设备: ${action.device ? action.device.name : '无关联设备'}`);
            console.log(`    描述: ${action.description || '无描述'}`);
          });
        }
      });
    }
    
    // 分析订单步骤中的动作
    if (orderData.data.orderSteps) {
      console.log('\n📋 Order Steps 分析:');
      orderData.data.orderSteps.forEach((orderStep, index) => {
        console.log(`订单步骤 ${index + 1}: ${orderStep.step.name}`);
        if (orderStep.step.actions) {
          orderStep.step.actions.forEach((action, actionIndex) => {
            console.log(`  动作 ${actionIndex + 1}: ${action.name}`);
            console.log(`    类型: ${action.type}`);
            console.log(`    设备: ${action.device ? action.device.name : '无关联设备'}`);
            console.log(`    设备ID: ${action.deviceId || '无设备ID'}`);
            console.log(`    描述: ${action.description || '无描述'}`);
          });
        }
      });
    }
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
  }
}

testOrderAPI();
