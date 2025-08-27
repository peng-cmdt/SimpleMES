import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 开始创建完整的测试数据...')

  // 获取已创建的工位和设备
  const workstation = await prisma.workstation.findFirst({
    where: { workstationId: 'WS-001' }
  });

  if (!workstation) {
    throw new Error('工位数据不存在，请先运行基础种子数据');
  }

  // 获取设备列表
  const devices = await prisma.device.findMany({
    where: { workstationId: workstation.id }
  });

  console.log(`找到 ${devices.length} 个设备`);

  // 创建产品
  const product = await prisma.product.upsert({
    where: { productCode: 'MERCEDES_AMG_GT63S' },
    update: {},
    create: {
      productCode: 'MERCEDES_AMG_GT63S',
      name: 'Mercedes-AMG GT 63 S 4MATIC+',
      description: 'High-performance luxury coupe',
      version: '1.0',
      status: 'active'
    }
  });

  console.log('✅ 产品创建完成:', product.name);

  // 创建BOM
  const bom = await prisma.bOM.upsert({
    where: { bomCode: 'BOM_AMG_GT63S_V1' },
    update: {},
    create: {
      bomCode: 'BOM_AMG_GT63S_V1',
      name: 'AMG GT63S Bill of Materials',
      version: '1.0',
      productId: product.id,
      description: 'Complete BOM for AMG GT63S assembly',
      status: 'active'
    }
  });

  console.log('✅ BOM创建完成:', bom.name);

  // 创建工艺流程
  const process = await prisma.process.upsert({
    where: { processCode: 'PROC_AMG_GT63S_ASSEMBLY' },
    update: {},
    create: {
      processCode: 'PROC_AMG_GT63S_ASSEMBLY',
      name: 'AMG GT63S Assembly Process',
      productId: product.id,
      version: '1.0',
      description: 'Complete assembly process for AMG GT63S',
      status: 'active'
    }
  });

  console.log('✅ 工艺流程创建完成:', process.name);

  // 创建步骤模板
  const stepTemplate = await prisma.stepTemplate.upsert({
    where: { stepCode: 'M1.00.STEP1' },
    update: {},
    create: {
      stepCode: 'M1.00.STEP1',
      name: 'M1.00.STEP1',
      category: 'ASSEMBLY',
      workstationType: 'VISUAL_CLIENT',
      workstationId: workstation.id,
      description: 'Engine and transmission mounting',
      instructions: '请按照以下步骤进行发动机和变速箱安装：\\n1. 检查发动机安装位置\\n2. 安装变速箱连接件\\n3. 固定发动机支撑\\n4. 连接管路系统',
      image: '/uploads/images/engine_mounting.jpg',
      estimatedTime: 1800,
      isRequired: true,
      status: 'active'
    }
  });

  console.log('✅ 步骤模板创建完成:', stepTemplate.name);

  // 创建步骤
  const step = await prisma.step.upsert({
    where: { 
      processId_sequence: {
        processId: process.id,
        sequence: 1
      }
    },
    update: {},
    create: {
      processId: process.id,
      stepTemplateId: stepTemplate.id,
      stepCode: 'M1.00.STEP1',
      name: 'M1.00.STEP1',
      workstationId: workstation.id,
      sequence: 1,
      description: 'Engine and transmission mounting',
      estimatedTime: 1800,
      isRequired: true
    }
  });

  console.log('✅ 步骤创建完成:', step.name);

  // 获取具体设备用于Action关联
  const autostartDevice = devices.find(d => d.deviceId === 'AUTOSTART');
  const clecoDevice = devices.find(d => d.deviceId === 'CLECO_BIG');
  const plcDevice = devices.find(d => d.deviceId === 'EKF_PLC');
  const scannerDevice = devices.find(d => d.deviceId === 'HONEYWELL_SCANNER');

  console.log('🔍 设备查找结果:');
  console.log(`AUTOSTART: ${autostartDevice ? autostartDevice.name : '未找到'}`);
  console.log(`CLECO_BIG: ${clecoDevice ? clecoDevice.name : '未找到'}`);
  console.log(`EKF_PLC: ${plcDevice ? plcDevice.name : '未找到'}`);
  console.log(`HONEYWELL_SCANNER: ${scannerDevice ? scannerDevice.name : '未找到'}`);

  // 创建4个动作 Action1-Action4，每个都关联到具体设备
  const actionsData = [
    {
      stepId: step.id,
      actionCode: 'ACTION1',
      name: 'Action1 - PLC Status Check',
      type: 'DEVICE_READ',
      sequence: 1,
      deviceId: autostartDevice?.id,
      deviceAddress: 'DB10.DBX0.0',
      expectedValue: '1',
      validationRule: 'equals',
      parameters: {
        sensorValue: 'DB10.DBX0.0=1',
        completionCondition: 'DB10.DBX0.0=1',
        timeout: 30,
        description: 'Check AUTOSTART PLC status signal'
      },
      description: 'Check AUTOSTART device PLC status signal at DB10.DBX0.0',
      isRequired: true,
      timeout: 30,
      retryCount: 3
    },
    {
      stepId: step.id,
      actionCode: 'ACTION2',
      name: 'Action2 - Torque Check',
      type: 'DEVICE_READ',
      sequence: 2,
      deviceId: clecoDevice?.id,
      deviceAddress: 'DB20.DBX1.0',
      expectedValue: '1',
      validationRule: 'equals',
      parameters: {
        sensorValue: 'DB20.DBX1.0=1',
        completionCondition: 'DB20.DBX1.0=1',
        timeout: 45,
        description: 'Check CLECO torque completion signal'
      },
      description: 'Verify torque operation completion from CLECO BIG device',
      isRequired: true,
      timeout: 45,
      retryCount: 2
    },
    {
      stepId: step.id,
      actionCode: 'ACTION3',
      name: 'Action3 - Main PLC Control',
      type: 'DEVICE_WRITE',
      sequence: 3,
      deviceId: plcDevice?.id,
      deviceAddress: 'DB30.DBX2.0',
      expectedValue: '1',
      validationRule: 'equals',
      parameters: {
        writeValue: true,
        sensorValue: 'DB30.DBX2.0=1',
        completionCondition: 'DB30.DBX2.0=1',
        timeout: 25,
        description: 'Send control signal to main PLC'
      },
      description: 'Send control signal to EKF PLC main controller',
      isRequired: true,
      timeout: 25,
      retryCount: 3
    },
    {
      stepId: step.id,
      actionCode: 'ACTION4',
      name: 'Action4 - Barcode Scan',
      type: 'BARCODE_SCAN',
      sequence: 4,
      deviceId: scannerDevice?.id,
      deviceAddress: 'SCAN_INPUT',
      expectedValue: 'ANY',
      validationRule: 'not_empty',
      parameters: {
        scanTimeout: 60,
        scanFormat: 'CODE128',
        description: 'Scan component barcode for traceability'
      },
      description: 'Scan component barcode using HONEYWELL scanner',
      isRequired: true,
      timeout: 60,
      retryCount: 1
    }
  ];

  // 创建Actions
  for (const actionData of actionsData) {
    const action = await prisma.action.upsert({
      where: {
        stepId_sequence: {
          stepId: actionData.stepId,
          sequence: actionData.sequence
        }
      },
      update: {},
      create: actionData
    });
    
    const deviceName = actionData.deviceId ? devices.find(d => d.id === actionData.deviceId)?.name : '无';
    console.log(`✅ 动作创建完成: ${action.name} (关联设备: ${deviceName})`);
  }

  // 创建订单
  const order = await prisma.order.upsert({
    where: { orderNumber: 'ORD-AMG-001' },
    update: {},
    create: {
      orderNumber: 'ORD-AMG-001',
      productionNumber: 'PROD-20240826-001',
      productId: product.id,
      bomId: bom.id,
      processId: process.id,
      quantity: 1,
      completedQuantity: 0,
      priority: 1,
      status: 'PENDING',
      plannedDate: new Date('2024-08-27'),
      currentStationId: workstation.id,
      notes: 'Test order for AMG GT63S assembly',
      createdBy: 'system',
      importSource: 'seed'
    }
  });

  console.log('✅ 订单创建完成:', order.orderNumber);

  // 创建订单步骤
  const orderStep = await prisma.orderStep.upsert({
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
      workstationId: workstation.id,
      status: 'pending'
    }
  });

  console.log('✅ 订单步骤创建完成');

  console.log('\n🎉 === 完整测试数据创建完成 ===');
  console.log(`产品: ${product.name}`);
  console.log(`工艺: ${process.name}`);  
  console.log(`步骤: ${step.name}`);
  console.log(`订单: ${order.orderNumber}`);
  console.log('包含4个动作，分别关联到不同设备');
}

main()
  .catch((e) => {
    console.error('❌ 创建测试数据失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })