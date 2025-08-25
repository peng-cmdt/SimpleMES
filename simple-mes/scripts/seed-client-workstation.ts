import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createClientWorkstationData() {
  try {
    console.log('创建客户端工位所需的测试数据...');

    // 1. 获取默认工位
    const workstation = await prisma.workstation.findFirst({
      where: { workstationId: 'WS-001' }
    });

    if (!workstation) {
      console.error('未找到工位 WS-001，请先运行主种子脚本');
      return;
    }

    // 2. 创建V174产品
    const product = await prisma.product.upsert({
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

    // 3. 创建BOM
    const bom = await prisma.bOM.upsert({
      where: { bomCode: 'BOM-V174-V1' },
      update: {},
      create: {
        bomCode: 'BOM-V174-V1',
        name: 'V174 车型物料清单',
        version: '1.0',
        productId: product.id,
        description: 'V174 车型的标准物料清单',
        status: 'active'
      }
    });

    // 4. 创建步骤模板（带图片）
    const stepTemplate1 = await prisma.stepTemplate.upsert({
      where: { stepCode: 'ST-SCAN-SENSOR-1' },
      update: {
        image: '/api/placeholder/600/400'
      },
      create: {
        stepCode: 'ST-SCAN-SENSOR-1',
        name: '扫描左手边压力传感器',
        category: '传感器扫描',
        workstationType: 'VISUAL_CLIENT',
        workstationId: workstation.id,
        description: '扫描左手边压力传感器',
        instructions: '请扫描左手边压力传感器\\n\\n操作步骤：\\n1. 找到左侧压力传感器位置\\n2. 使用扫描枪扫描传感器二维码\\n3. 确认扫描结果',
        image: '/api/placeholder/600/400',
        estimatedTime: 30,
        isRequired: true,
        status: 'active'
      }
    });

    const stepTemplate2 = await prisma.stepTemplate.upsert({
      where: { stepCode: 'ST-SCREW-ASSEMBLY' },
      update: {
        image: '/api/placeholder/600/400'
      },
      create: {
        stepCode: 'ST-SCREW-ASSEMBLY',
        name: '螺丝组装作业',
        category: '装配作业',
        workstationType: 'VISUAL_CLIENT',
        workstationId: workstation.id,
        description: '进行螺丝组装作业',
        instructions: '请按照图示进行螺丝组装\\n\\n操作步骤：\\n1. 确认螺丝规格和数量\\n2. 按扭矩要求拧紧螺丝\\n3. 检查装配质量',
        image: '/api/placeholder/600/400',
        estimatedTime: 60,
        isRequired: true,
        status: 'active'
      }
    });

    const stepTemplate3 = await prisma.stepTemplate.upsert({
      where: { stepCode: 'ST-QUALITY-CHECK' },
      update: {
        image: '/api/placeholder/600/400'
      },
      create: {
        stepCode: 'ST-QUALITY-CHECK',
        name: '装配质量检查',
        category: '质量检查',
        workstationType: 'VISUAL_CLIENT',
        workstationId: workstation.id,
        description: '进行装配质量检查',
        instructions: '请检查装配质量\\n\\n检查项目：\\n1. 零件安装是否到位\\n2. 螺丝是否拧紧\\n3. 外观是否良好',
        image: '/api/placeholder/600/400',
        estimatedTime: 45,
        isRequired: true,
        status: 'active'
      }
    });

    // 5. 创建工艺流程
    const process = await prisma.process.upsert({
      where: { processCode: 'PROC-V174-MAIN' },
      update: {},
      create: {
        processCode: 'PROC-V174-MAIN',
        name: 'V174主线生产工艺',
        productId: product.id,
        version: '1.0',
        description: 'V174车型主线生产工艺流程：传感器扫描->螺丝组装->质量检查',
        status: 'active'
      }
    });

    // 6. 创建工艺步骤（从模板创建）
    const step1 = await prisma.step.upsert({
      where: { processId_sequence: { processId: process.id, sequence: 1 } },
      update: {},
      create: {
        processId: process.id,
        stepTemplateId: stepTemplate1.id,
        stepCode: 'S1',
        name: stepTemplate1.name,
        workstationId: workstation.id,
        sequence: 1,
        description: stepTemplate1.description,
        estimatedTime: stepTemplate1.estimatedTime,
        isRequired: true
      }
    });

    const step2 = await prisma.step.upsert({
      where: { processId_sequence: { processId: process.id, sequence: 2 } },
      update: {},
      create: {
        processId: process.id,
        stepTemplateId: stepTemplate2.id,
        stepCode: 'S2',
        name: stepTemplate2.name,
        workstationId: workstation.id,
        sequence: 2,
        description: stepTemplate2.description,
        estimatedTime: stepTemplate2.estimatedTime,
        isRequired: true
      }
    });

    const step3 = await prisma.step.upsert({
      where: { processId_sequence: { processId: process.id, sequence: 3 } },
      update: {},
      create: {
        processId: process.id,
        stepTemplateId: stepTemplate3.id,
        stepCode: 'S3',
        name: stepTemplate3.name,
        workstationId: workstation.id,
        sequence: 3,
        description: stepTemplate3.description,
        estimatedTime: stepTemplate3.estimatedTime,
        isRequired: true
      }
    });

    // 7. 获取设备并创建动作
    const scannerDevice = await prisma.device.findFirst({
      where: { type: 'BARCODE_SCANNER' }
    });

    // 为步骤创建动作（使用ActionType枚举）
    if (scannerDevice) {
      await prisma.action.upsert({
        where: { stepId_sequence: { stepId: step1.id, sequence: 1 } },
        update: {},
        create: {
          stepId: step1.id,
          actionCode: 'A1',
          name: 'SCANNING SENSOR 1',
          type: 'BARCODE_SCAN',
          sequence: 1,
          deviceId: scannerDevice.id,
          description: '扫描传感器1',
          parameters: {
            expectedPattern: 'SENSOR_\\\\d+',
            timeout: 30
          },
          isRequired: true,
          timeout: 30
        }
      });
    }

    await prisma.action.upsert({
      where: { stepId_sequence: { stepId: step1.id, sequence: 2 } },
      update: {},
      create: {
        stepId: step1.id,
        actionCode: 'A1-CONFIRM',
        name: 'CONFIRM SCREW 1',
        type: 'MANUAL_CONFIRM',
        sequence: 2,
        description: '确认螺丝1已拧紧',
        parameters: {
          confirmationMessage: '请确认螺丝1已正确拧紧'
        },
        isRequired: true
      }
    });

    await prisma.action.upsert({
      where: { stepId_sequence: { stepId: step2.id, sequence: 1 } },
      update: {},
      create: {
        stepId: step2.id,
        actionCode: 'A2',
        name: 'SCREW_2',
        type: 'MANUAL_CONFIRM',
        sequence: 1,
        description: '拧螺丝2',
        parameters: {
          confirmationMessage: '请确认螺丝2已正确拧紧'
        },
        isRequired: true
      }
    });

    await prisma.action.upsert({
      where: { stepId_sequence: { stepId: step3.id, sequence: 1 } },
      update: {},
      create: {
        stepId: step3.id,
        actionCode: 'A3',
        name: 'QUALITY CHECK',
        type: 'MANUAL_CONFIRM',
        sequence: 1,
        description: '质量检查确认',
        parameters: {
          confirmationMessage: '请确认装配质量符合要求'
        },
        isRequired: true
      }
    });

    // 8. 创建产品工艺路线
    await prisma.productWorkstation.upsert({
      where: {
        productId_workstationId: {
          productId: product.id,
          workstationId: workstation.id
        }
      },
      update: {},
      create: {
        productId: product.id,
        workstationId: workstation.id,
        sequence: 1
      }
    });

    // 9. 创建测试订单（O1-O4，T001-T004）
    const ordersData = [
      {
        orderNumber: 'O1',
        productionNumber: 'T001',
        quantity: 1,
        priority: 1,
        notes: 'CARR-c0p2p3'
      },
      {
        orderNumber: 'O2', 
        productionNumber: 'T002',
        quantity: 1,
        priority: 2,
        notes: 'CARR-s1ye2v'
      },
      {
        orderNumber: 'O3',
        productionNumber: 'T003',
        quantity: 1,
        priority: 3,
        notes: 'CARR-x8m4n9'
      },
      {
        orderNumber: 'O4',
        productionNumber: 'T004',
        quantity: 1,
        priority: 4,
        notes: 'CARR-h5k7l2'
      }
    ];

    for (const orderData of ordersData) {
      const order = await prisma.order.upsert({
        where: { orderNumber: orderData.orderNumber },
        update: {},
        create: {
          orderNumber: orderData.orderNumber,
          productionNumber: orderData.productionNumber,
          productId: product.id,
          bomId: bom.id,
          processId: process.id,
          quantity: orderData.quantity,
          priority: orderData.priority,
          status: 'PENDING',
          plannedDate: new Date('2025-08-24'),
          notes: orderData.notes,
          createdBy: 'system',
          importSource: 'seed'
        }
      });

      // 为每个订单创建订单步骤
      const orderSteps = [step1, step2, step3];
      for (const step of orderSteps) {
        await prisma.orderStep.upsert({
          where: {
            orderId_stepId: {
              orderId: order.id,
              stepId: step.id
            }
          },
          update: {},
          create: {
            orderId: order.id,
            stepId: step.id,
            workstationId: step.workstationId,
            status: 'pending'
          }
        });
      }
    }

    console.log('✅ 客户端工位测试数据创建完成！');
    console.log(`创建产品: ${product.name}`);
    console.log(`创建BOM: ${bom.name}`);
    console.log(`创建工艺流程: ${process.name}`);
    console.log(`创建步骤模板: ${stepTemplate1.name}, ${stepTemplate2.name}, ${stepTemplate3.name}`);
    console.log(`创建订单: O1, O2, O3, O4`);

  } catch (error) {
    console.error('❌ 测试数据创建失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createClientWorkstationData()
    .then(() => {
      console.log('客户端工位数据种子脚本执行完成');
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error(error);
      prisma.$disconnect();
      process.exit(1);
    });
}

export { createClientWorkstationData };