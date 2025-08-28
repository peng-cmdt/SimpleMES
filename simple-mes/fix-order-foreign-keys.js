const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOrderForeignKeys() {
  try {
    console.log('🔍 检查并修复订单外键约束问题...');
    
    // 查找所有有问题的订单
    const ordersWithFKIssues = await prisma.order.findMany({
      where: {
        OR: [
          { currentStationId: { not: null } },
          { currentStepId: { not: null } }
        ]
      },
      include: {
        currentStation: true,
        currentStep: true,
        product: true
      }
    });
    
    console.log(`📊 找到 ${ordersWithFKIssues.length} 个可能有外键问题的订单`);
    
    for (const order of ordersWithFKIssues) {
      console.log(`\n🔧 检查订单: ${order.orderNumber} (${order.id})`);
      console.log(`   currentStationId: ${order.currentStationId}`);
      console.log(`   currentStepId: ${order.currentStepId}`);
      
      let needsUpdate = false;
      const updateData = {};
      
      // 检查currentStationId是否有效
      if (order.currentStationId && !order.currentStation) {
        console.log(`   ❌ currentStationId (${order.currentStationId}) 指向不存在的工作站`);
        updateData.currentStationId = null;
        needsUpdate = true;
      }
      
      // 检查currentStepId是否有效
      if (order.currentStepId && !order.currentStep) {
        console.log(`   ❌ currentStepId (${order.currentStepId}) 指向不存在的步骤`);
        updateData.currentStepId = null;
        needsUpdate = true;
      }
      
      // 如果需要更新，清理无效的外键
      if (needsUpdate) {
        console.log(`   🛠️ 清理无效外键...`);
        await prisma.order.update({
          where: { id: order.id },
          data: updateData
        });
        console.log(`   ✅ 订单 ${order.orderNumber} 已修复`);
      } else {
        console.log(`   ✅ 订单 ${order.orderNumber} 外键正常`);
      }
    }
    
    console.log('\n🎉 所有订单外键检查完成！');
    
  } catch (error) {
    console.error('❌ 修复过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrderForeignKeys();