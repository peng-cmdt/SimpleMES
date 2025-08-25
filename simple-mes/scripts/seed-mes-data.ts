import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedMESData() {
  console.log('开始初始化MES基础数据...');

  try {
    // 1. 创建示例产品
    const productA = await prisma.product.upsert({
      where: { productCode: 'V174' },
      update: {},
      create: {
        productCode: 'V174',
        name: 'V174 车型',
        description: 'Mercedes V174 车型生产',
        version: '1.0',
        status: 'active'
      }
    });

    const productB = await prisma.product.upsert({
      where: { productCode: 'V175' },
      update: {},
      create: {
        productCode: 'V175',
        name: 'V175 车型',
        description: 'Mercedes V175 车型生产',
        version: '1.0',
        status: 'active'
      }
    });

    console.log('✓ 创建示例产品完成');

    // 2. 创建BOM
    const bomA = await prisma.bOM.upsert({
      where: { bomCode: 'BOM-A001-V1' },
      update: {},
      create: {
        bomCode: 'BOM-A001-V1',
        name: '产品A物料清单',
        version: '1.0',
        productId: productA.id,
        description: '产品A的标准物料清单',
        status: 'active'
      }
    });

    const bomB = await prisma.bOM.upsert({
      where: { bomCode: 'BOM-B001-V1' },
      update: {},
      create: {
        bomCode: 'BOM-B001-V1',
        name: '产品B物料清单',
        version: '1.0',
        productId: productB.id,
        description: '产品B的标准物料清单',
        status: 'active'
      }
    });

    console.log('✓ 创建BOM完成');

    // 3. 创建BOM物料明细
    const bomItemsA = [
      { itemCode: 'MAT-001', itemName: '主板', quantity: 1, unit: '个' },
      { itemCode: 'MAT-002', itemName: '螺丝M3*10', quantity: 4, unit: '个' },
      { itemCode: 'MAT-003', itemName: '外壳', quantity: 1, unit: '个' },
      { itemCode: 'MAT-004', itemName: '标签', quantity: 1, unit: '张' }
    ];

    for (const item of bomItemsA) {
      await prisma.bOMItem.upsert({
        where: { id: `${bomA.id}-${item.itemCode}` },
        update: {},
        create: {
          id: `${bomA.id}-${item.itemCode}`,
          bomId: bomA.id,
          ...item,
          description: `产品A所需${item.itemName}`
        }
      });
    }

    const bomItemsB = [
      { itemCode: 'MAT-005', itemName: '控制器', quantity: 1, unit: '个' },
      { itemCode: 'MAT-006', itemName: '传感器', quantity: 2, unit: '个' },
      { itemCode: 'MAT-007', itemName: '连接线', quantity: 3, unit: '根' },
      { itemCode: 'MAT-008', itemName: '机箱', quantity: 1, unit: '个' }
    ];

    for (const item of bomItemsB) {
      await prisma.bOMItem.upsert({
        where: { id: `${bomB.id}-${item.itemCode}` },
        update: {},
        create: {
          id: `${bomB.id}-${item.itemCode}`,
          bomId: bomB.id,
          ...item,
          description: `产品B所需${item.itemName}`
        }
      });
    }

    console.log('✓ 创建BOM物料明细完成');

    // 4. 获取现有工位
    const workstations = await prisma.workstation.findMany();
    console.log(`找到 ${workstations.length} 个工位`);

    // 5. 创建工艺流程
    const processA = await prisma.process.upsert({
      where: { processCode: 'PROCESS-A001' },
      update: {},
      create: {
        processCode: 'PROCESS-A001',
        name: '产品A标准工艺流程',
        productId: productA.id,
        version: '1.0',
        description: '产品A的标准生产工艺流程：组装->检测->包装',
        status: 'active'
      }
    });

    const processB = await prisma.process.upsert({
      where: { processCode: 'PROCESS-B001' },
      update: {},
      create: {
        processCode: 'PROCESS-B001',
        name: '产品B标准工艺流程',
        productId: productB.id,
        version: '1.0',
        description: '产品B的标准生产工艺流程：预装->组装->调试->测试->包装',
        status: 'active'
      }
    });

    console.log('✓ 创建工艺流程完成');

    // 6. 创建工艺步骤（产品A）
    const stepsA = [
      {
        stepCode: 'S1',
        name: '物料准备',
        sequence: 1,
        description: '准备生产所需的所有物料',
        estimatedTime: 300, // 5分钟
        workstationId: workstations[0]?.id
      },
      {
        stepCode: 'S2',
        name: '主板组装',
        sequence: 2,
        description: '将主板安装到外壳中',
        estimatedTime: 600, // 10分钟
        workstationId: workstations[1]?.id
      },
      {
        stepCode: 'S3',
        name: '螺丝固定',
        sequence: 3,
        description: '使用螺丝固定主板',
        estimatedTime: 180, // 3分钟
        workstationId: workstations[1]?.id
      },
      {
        stepCode: 'S4',
        name: '功能检测',
        sequence: 4,
        description: '检测产品功能是否正常',
        estimatedTime: 480, // 8分钟
        workstationId: workstations[2]?.id
      },
      {
        stepCode: 'S5',
        name: '贴标签',
        sequence: 5,
        description: '贴上产品标签',
        estimatedTime: 120, // 2分钟
        workstationId: workstations[3]?.id
      }
    ];

    for (const step of stepsA) {
      await prisma.step.upsert({
        where: { processId_sequence: { processId: processA.id, sequence: step.sequence } },
        update: {},
        create: {
          processId: processA.id,
          ...step
        }
      });
    }

    console.log('✓ 创建产品A工艺步骤完成');

    // 7. 获取现有设备
    const devices = await prisma.device.findMany();
    console.log(`找到 ${devices.length} 个设备`);

    // 8. 为步骤创建动作（仅为前几个步骤创建示例动作）
    const steps = await prisma.step.findMany({
      where: { processId: processA.id },
      orderBy: { sequence: 'asc' }
    });

    if (steps.length > 0) {
      // S1: 物料准备的动作
      const actionsS1 = [
        {
          actionCode: 'A1',
          name: '扫描物料条码',
          type: 'BARCODE_SCAN',
          sequence: 1,
          description: '扫描主板条码验证物料',
          parameters: {
            expectedPattern: '^MAT-001-\\d{8}$',
            timeout: 30
          },
          deviceId: devices.find(d => d.type === 'BARCODE_SCANNER')?.id
        },
        {
          actionCode: 'A2',
          name: '确认物料齐全',
          type: 'MANUAL_CONFIRM',
          sequence: 2,
          description: '人工确认所有物料已准备齐全',
          parameters: {
            confirmText: '请确认所有物料已准备齐全',
            requiredConfirm: true
          }
        }
      ];

      for (const action of actionsS1) {
        await prisma.action.upsert({
          where: { stepId_sequence: { stepId: steps[0].id, sequence: action.sequence } },
          update: {},
          create: {
            stepId: steps[0].id,
            ...action
          }
        });
      }

      // S2: 主板组装的动作
      const actionsS2 = [
        {
          actionCode: 'A1',
          name: '检测工位状态',
          type: 'DEVICE_READ',
          sequence: 1,
          description: '读取PLC工位准备状态',
          deviceId: devices.find(d => d.type === 'PLC_CONTROLLER')?.id,
          deviceAddress: 'D100',
          expectedValue: '1',
          validationRule: JSON.stringify({ type: 'equals', value: '1' }),
          parameters: {
            readType: 'single',
            dataType: 'int16'
          }
        },
        {
          actionCode: 'A2',
          name: '启动组装程序',
          type: 'DEVICE_WRITE',
          sequence: 2,
          description: '向PLC写入启动信号',
          deviceId: devices.find(d => d.type === 'PLC_CONTROLLER')?.id,
          deviceAddress: 'D200',
          expectedValue: '1',
          parameters: {
            writeValue: '1',
            dataType: 'int16'
          }
        },
        {
          actionCode: 'A3',
          name: '等待组装完成',
          type: 'DEVICE_READ',
          sequence: 3,
          description: '等待PLC组装完成信号',
          deviceId: devices.find(d => d.type === 'PLC_CONTROLLER')?.id,
          deviceAddress: 'D201',
          expectedValue: '1',
          validationRule: JSON.stringify({ type: 'equals', value: '1' }),
          timeout: 120,
          parameters: {
            polling: true,
            pollingInterval: 1000
          }
        }
      ];

      for (const action of actionsS2) {
        await prisma.action.upsert({
          where: { stepId_sequence: { stepId: steps[1].id, sequence: action.sequence } },
          update: {},
          create: {
            stepId: steps[1].id,
            ...action
          }
        });
      }

      console.log('✓ 创建示例动作完成');
    }

    // 9. 创建示例订单
    const order1 = await prisma.order.upsert({
      where: { orderNumber: 'ORD-20250817-001' },
      update: {},
      create: {
        orderNumber: 'ORD-20250817-001',
        productionNumber: 'PROD-20250817-001',
        productId: productA.id,
        bomId: bomA.id,
        processId: processA.id,
        quantity: 10,
        priority: 1,
        status: 'PENDING',
        plannedDate: new Date('2025-08-18'),
        notes: '示例生产订单 - 产品A',
        createdBy: 'system'
      }
    });

    const order2 = await prisma.order.upsert({
      where: { orderNumber: 'ORD-20250817-002' },
      update: {},
      create: {
        orderNumber: 'ORD-20250817-002',
        productionNumber: 'PROD-20250817-002',
        productId: productB.id,
        bomId: bomB.id,
        processId: processB.id,
        quantity: 5,
        priority: 2,
        status: 'PENDING',
        plannedDate: new Date('2025-08-19'),
        notes: '示例生产订单 - 产品B',
        createdBy: 'system'
      }
    });

    console.log('✓ 创建示例订单完成');

    console.log('\n✅ MES基础数据初始化完成！');
    console.log(`创建产品: ${productA.name}, ${productB.name}`);
    console.log(`创建BOM: ${bomA.name}, ${bomB.name}`);
    console.log(`创建工艺流程: ${processA.name}, ${processB.name}`);
    console.log(`创建订单: ${order1.orderNumber}, ${order2.orderNumber}`);

  } catch (error) {
    console.error('❌ MES数据初始化失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedMESData()
    .then(() => {
      console.log('MES数据种子脚本执行完成');
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error(error);
      prisma.$disconnect();
      process.exit(1);
    });
}

export { seedMESData };