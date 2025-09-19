const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyMonitoring() {
  console.log('=== 验证订单监测数据 ===\n');

  try {
    // 模拟API查询逻辑
    const orders = await prisma.order.findMany({
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true
          }
        },
        process: {
          select: {
            id: true,
            processCode: true,
            name: true,
            version: true
          }
        },
        workstationOrderQueues: {
          where: {
            isVisible: true
          },
          include: {
            workstation: {
              select: {
                id: true,
                workstationId: true,
                name: true,
                isOrderCompleteStation: true
              }
            }
          },
          orderBy: {
            sequence: 'asc'
          }
        }
      },
      orderBy: [
        { priority: 'asc' },
        { sequence: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    console.log(`找到 ${orders.length} 个订单\n`);

    orders.forEach(order => {
      console.log(`📋 订单: ${order.orderNumber}`);
      console.log(`   产品: ${order.product.productCode} - ${order.product.name}`);
      console.log(`   工艺: ${order.process.processCode} - ${order.process.name}`);
      console.log(`   分配工位 (${order.workstationOrderQueues.length}个):`);
      
      if (order.workstationOrderQueues.length === 0) {
        console.log('     ❌ 没有分配到任何工位');
      } else {
        order.workstationOrderQueues.forEach((queue, index) => {
          console.log(`     ${queue.sequence}. ${queue.workstation.workstationId} - ${queue.workstation.name} (${queue.status})`);
        });
      }

      // 验证是否符合预期
      const expectedWorkstations = {
        '174': ['M1', 'M0'],
        '178': ['M0', 'M2']
      };

      const productCode = order.product.productCode;
      const expected = expectedWorkstations[productCode];
      const actual = order.workstationOrderQueues.map(q => q.workstation.workstationId);

      if (expected && JSON.stringify(expected) === JSON.stringify(actual)) {
        console.log('     ✅ 工艺路线配置正确');
      } else if (expected) {
        console.log(`     ❌ 工艺路线配置错误 - 期望: ${expected.join(' → ')}, 实际: ${actual.join(' → ')}`);
      }

      console.log('');
    });

    // 统计各工位的订单分布
    console.log('=== 工位订单分布统计 ===\n');
    
    const workstationStats = {};
    
    orders.forEach(order => {
      order.workstationOrderQueues.forEach(queue => {
        const wsId = queue.workstation.workstationId;
        if (!workstationStats[wsId]) {
          workstationStats[wsId] = {
            name: queue.workstation.name,
            orders: []
          };
        }
        workstationStats[wsId].orders.push({
          orderNumber: order.orderNumber,
          productCode: order.product.productCode,
          status: queue.status
        });
      });
    });

    Object.entries(workstationStats).forEach(([wsId, data]) => {
      console.log(`🏭 工位 ${wsId} - ${data.name} (${data.orders.length}个订单):`);
      data.orders.forEach(order => {
        console.log(`   - ${order.orderNumber} (产品${order.productCode}) [${order.status}]`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('验证过程出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMonitoring().catch(console.error);