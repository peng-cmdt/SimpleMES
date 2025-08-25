import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始备份和还原数据...')

  // 备份现有工位数据
  const workstations = [
    {
      workstationId: 'WS-001',
      name: '生产工位A',
      description: '主装配工位',
      location: '车间一区',
      configuredIp: '192.168.1.101',
      status: 'offline',
      settings: {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    },
    {
      workstationId: 'WS-002',
      name: '生产工位B',
      description: '测试工位',
      location: '车间一区',
      configuredIp: '192.168.1.102',
      status: 'offline',
      settings: {
        autoConnect: true,
        timeout: 30000,
        retryCount: 3
      }
    }
  ]

  // 创建工位
  const createdWorkstations = {}
  for (const ws of workstations) {
    const workstation = await prisma.workstation.upsert({
      where: { workstationId: ws.workstationId },
      update: {},
      create: ws
    })
    createdWorkstations[ws.workstationId] = workstation
  }

  // 备份设备模板数据
  const deviceTemplates = [
    {
      name: 'S7-1200 PLC',
      type: 'PLC_CONTROLLER',
      brand: 'Siemens',
      model: 'S7-1200',
      description: '西门子S7-1200系列PLC',
      driver: 'S7PlcDriver',
      status: 'OFFLINE',
      isOnline: false
    },
    {
      name: '条码扫描器',
      type: 'BARCODE_SCANNER',
      brand: 'Honeywell',
      model: 'MS7580',
      description: '霍尼韦尔手持式条码扫描器',
      driver: 'BarcodeDriver',
      status: 'OFFLINE',
      isOnline: false
    },
    {
      name: '电动螺丝刀',
      type: 'SCREWDRIVER',
      brand: 'Atlas',
      model: 'ETP-STB25',
      description: '阿特拉斯电动螺丝刀',
      driver: 'ScrewdriverDriver',
      status: 'OFFLINE',
      isOnline: false
    }
  ]

  // 创建设备模板
  const createdDeviceTemplates = []
  for (const device of deviceTemplates) {
    const deviceId = `${device.type}-${device.name.replace(/\s+/g, '-')}`
    const created = await prisma.device.upsert({
      where: { deviceId: deviceId },
      update: {},
      create: {
        ...device,
        deviceId: deviceId
      }
    })
    createdDeviceTemplates.push(created)
  }

  // 创建工位分配的设备实例
  const workstationDevices = [
    {
      name: 'WS-001 PLC',
      type: 'PLC_CONTROLLER',
      brand: 'Siemens',
      model: 'S7-1200',
      description: '工位A专用PLC',
      driver: 'S7PlcDriver',
      workstationId: createdWorkstations['WS-001'].id,
      ipAddress: '192.168.1.201',
      port: 502,
      protocol: 'TCP',
      settings: {
        plcType: 'Siemens_S7',
        rack: 0,
        slot: 1
      },
      status: 'OFFLINE',
      isOnline: false
    },
    {
      name: 'WS-001 扫码枪',
      type: 'BARCODE_SCANNER',
      brand: 'Honeywell',
      model: 'MS7580',
      description: '工位A专用扫码枪',
      driver: 'BarcodeDriver',
      workstationId: createdWorkstations['WS-001'].id,
      ipAddress: '192.168.1.202',
      port: 9100,
      status: 'OFFLINE',
      isOnline: false
    },
    {
      name: 'WS-002 PLC',
      type: 'PLC_CONTROLLER',
      brand: 'Siemens',
      model: 'S7-1200',
      description: '工位B专用PLC',
      driver: 'S7PlcDriver',
      workstationId: createdWorkstations['WS-002'].id,
      ipAddress: '192.168.1.203',
      port: 502,
      protocol: 'TCP',
      settings: {
        plcType: 'Siemens_S7',
        rack: 0,
        slot: 1
      },
      status: 'OFFLINE',
      isOnline: false
    }
  ]

  // 创建工位设备实例
  for (const device of workstationDevices) {
    const deviceId = `${device.type}-${device.name.replace(/\s+/g, '-')}`
    await prisma.device.upsert({
      where: { deviceId: deviceId },
      update: {},
      create: {
        ...device,
        deviceId: deviceId
      }
    })
  }

  // 创建步骤模板
  const stepTemplates = [
    {
      stepCode: 'ST-244222',
      name: 'WS001.00.S2',
      description: '工位1步骤2',
      workstationId: createdWorkstations['WS-001'].id,
      category: '装配',
      estimatedTime: 60,
      isRequired: true,
      status: 'active'
    },
    {
      stepCode: 'ST-166174',
      name: 'WS001.00.S1',
      description: '工位1步骤1',
      workstationId: createdWorkstations['WS-001'].id,
      category: '装配',
      estimatedTime: 45,
      isRequired: true,
      status: 'active'
    }
  ]

  // 创建步骤模板
  for (const template of stepTemplates) {
    await prisma.stepTemplate.upsert({
      where: { stepCode: template.stepCode },
      update: {},
      create: template
    })
  }

  // 创建产品
  const products = [
    {
      productCode: 'PROD-001',
      name: '测试产品A',
      description: '用于测试的产品A',
      version: '1.0',
      status: 'active'
    }
  ]

  const createdProducts = []
  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { productCode: product.productCode },
      update: {},
      create: product
    })
    createdProducts.push(created)
  }

  // 创建工艺流程
  const processes = [
    {
      processCode: 'PROC-001',
      name: '测试工艺流程',
      description: '用于测试的工艺流程',
      version: '1.0',
      status: 'active',
      productId: createdProducts[0].id
    }
  ]

  for (const process of processes) {
    await prisma.process.upsert({
      where: { processCode: process.processCode },
      update: {},
      create: process
    })
  }

  console.log('✅ 数据备份和恢复完成')
  console.log('已创建:')
  console.log(`- ${workstations.length} 个工位`)
  console.log(`- ${deviceTemplates.length} 个设备模板`)
  console.log(`- ${workstationDevices.length} 个工位设备实例`)
  console.log(`- ${stepTemplates.length} 个步骤模板`)
  console.log(`- ${products.length} 个产品`)
  console.log(`- ${processes.length} 个工艺流程`)
}

main()
  .catch((e) => {
    console.error('备份恢复失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })