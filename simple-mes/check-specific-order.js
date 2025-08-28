const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpecificOrder() {
  try {
    const orderId = 'cmes7rlrp001atm1os69jjiew';
    console.log(`🔍 检查订单: ${orderId}`);
    
    // 查找特定订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: true,
        process: true,
        bom: true,
        currentStation: true,
        currentStep: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5
        }
      }
    });
    
    if (!order) {
      console.log('❌ 订单不存在');
      return;
    }
    
    console.log('📋 订单信息:');
    console.log(`   ID: ${order.id}`);
    console.log(`   订单号: ${order.orderNumber}`);
    console.log(`   生产号: ${order.productionNumber}`);
    console.log(`   状态: ${order.status}`);
    console.log(`   产品: ${order.product?.name || '未知'} (ID: ${order.productId})`);
    console.log(`   工艺: ${order.process?.name || '未知'} (ID: ${order.processId})`);
    console.log(`   BOM: ${order.bom?.bomCode || '无'} (ID: ${order.bomId || '无'})`);
    console.log(`   当前工作站ID: ${order.currentStationId || '无'}`);
    console.log(`   当前工作站: ${order.currentStation?.name || '无'}`);
    console.log(`   当前步骤ID: ${order.currentStepId || '无'}`);
    console.log(`   当前步骤: ${order.currentStep?.name || '无'}`);
    
    // 验证外键
    if (order.productId) {
      const product = await prisma.product.findUnique({ where: { id: order.productId } });
      console.log(`   ✅ 产品外键有效: ${!!product}`);
    }
    
    if (order.processId) {
      const process = await prisma.process.findUnique({ where: { id: order.processId } });
      console.log(`   ✅ 工艺外键有效: ${!!process}`);
    }
    
    if (order.bomId) {
      const bom = await prisma.bOM.findUnique({ where: { id: order.bomId } });
      console.log(`   ✅ BOM外键有效: ${!!bom}`);
    }
    
    if (order.currentStationId) {
      const station = await prisma.workstation.findUnique({ where: { id: order.currentStationId } });
      console.log(`   ✅ 当前工作站外键有效: ${!!station}`);
      if (!station) {
        console.log(`   🔧 清理无效的currentStationId...`);
        await prisma.order.update({
          where: { id: orderId },
          data: { currentStationId: null }
        });
        console.log(`   ✅ 已清理currentStationId`);
      }
    }
    
    if (order.currentStepId) {
      const step = await prisma.step.findUnique({ where: { id: order.currentStepId } });
      console.log(`   ✅ 当前步骤外键有效: ${!!step}`);
      if (!step) {
        console.log(`   🔧 清理无效的currentStepId...`);
        await prisma.order.update({
          where: { id: orderId },
          data: { currentStepId: null }
        });
        console.log(`   ✅ 已清理currentStepId`);
      }
    }
    
    console.log('\n📊 状态历史:');
    order.statusHistory.forEach((history, index) => {
      console.log(`   ${index + 1}. ${history.fromStatus || '无'} → ${history.toStatus} (${history.changedAt.toISOString()})`);
    });
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificOrder();