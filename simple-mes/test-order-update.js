const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testOrderUpdate() {
  try {
    const orderId = 'cmes7rlrp001atm1os69jjiew';
    const workstationId = 'cmes6s081006htmuwhsl0gpri';
    
    console.log('🧪 测试订单状态更新...');
    console.log(`   订单ID: ${orderId}`);
    console.log(`   工作站ID: ${workstationId}`);
    
    // 先检查订单和工作站是否存在
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const workstation = await prisma.workstation.findUnique({ where: { id: workstationId } });
    
    console.log(`   订单存在: ${!!order}`);
    console.log(`   工作站存在: ${!!workstation}`);
    
    if (!order || !workstation) {
      console.log('❌ 基础数据不存在，停止测试');
      return;
    }
    
    console.log('🔄 尝试更新订单状态...');
    
    // 准备更新数据 - 模拟我们修复后的代码逻辑
    const updateData = {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      updatedAt: new Date(),
      currentStationId: workstationId  // 明确提供工作站ID
    };
    
    console.log('📝 更新数据:', updateData);
    
    // 开始事务
    await prisma.$transaction(async (tx) => {
      // 第一步：更新订单
      console.log('   1️⃣ 更新订单状态...');
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: updateData
      });
      console.log('   ✅ 订单状态更新成功');
      
      // 第二步：创建状态历史
      console.log('   2️⃣ 创建状态历史记录...');
      const statusHistory = await tx.orderStatusHistory.create({
        data: {
          orderId: orderId,
          fromStatus: order.status,
          toStatus: 'IN_PROGRESS',
          changedBy: 'test',
          changedAt: new Date(),
          reason: '测试状态更新'
        }
      });
      console.log('   ✅ 状态历史记录创建成功');
      
      return updatedOrder;
    });
    
    console.log('🎉 订单状态更新完全成功！');
    
    // 查看更新后的订单
    const finalOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        currentStation: true,
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 1
        }
      }
    });
    
    console.log('📊 更新后的订单状态:');
    console.log(`   状态: ${finalOrder.status}`);
    console.log(`   当前工作站: ${finalOrder.currentStation?.name || '无'}`);
    console.log(`   最新历史: ${finalOrder.statusHistory[0]?.fromStatus} → ${finalOrder.statusHistory[0]?.toStatus}`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    if (error.meta) {
      console.error('错误元数据:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testOrderUpdate();