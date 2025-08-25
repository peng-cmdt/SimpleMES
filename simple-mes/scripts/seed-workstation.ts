import { PrismaClient, DeviceType, DeviceStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建工位和设备测试数据...')

  // 创建测试工位
  const workstation1 = await prisma.workstation.upsert({
    where: { workstationId: 'WS001' },
    update: {},
    create: {
      workstationId: 'WS001',
      name: '装配工位1',
      description: '主装配线第一工位',
      location: '车间A-01',
      configuredIp: '192.168.1.10'
    }
  })

  const workstation2 = await prisma.workstation.upsert({
    where: { workstationId: 'WS002' },
    update: {},
    create: {
      workstationId: 'WS002',
      name: '测试工位1',
      description: '产品质量测试工位',
      location: '车间A-02',
      configuredIp: '192.168.1.11'
    }
  })

  console.log('创建的工位:', { workstation1, workstation2 })

  // 为工位1创建设备
  const plcDevice1 = await prisma.device.upsert({
    where: { deviceId: 'PLC-WS001-01' },
    update: {},
    create: {
      deviceId: 'PLC-WS001-01',
      name: 'PLC控制器-工位1',
      type: DeviceType.PLC_CONTROLLER,
      brand: '西门子',
      model: 'S7-1200',
      driver: 'PlcDriver',
      description: '工位1主控PLC',
      workstationId: workstation1.id,
      ipAddress: '192.168.1.100',
      port: 102,
      protocol: 'S7',
      connectionString: 'S7://192.168.1.100:102',
      settings: {
        plcType: 'Siemens_S7',
        cpuType: 'S7_1200',
        rack: 0,
        slot: 1
      }
    }
  })

  const scanner1 = await prisma.device.upsert({
    where: { deviceId: 'SCANNER-WS001-01' },
    update: {},
    create: {
      deviceId: 'SCANNER-WS001-01',
      name: '扫码枪-工位1',
      type: DeviceType.BARCODE_SCANNER,
      brand: '基恩士',
      model: 'SR-1000',
      driver: 'ScannerDriver',
      description: '工位1产品扫码枪',
      workstationId: workstation1.id,
      ipAddress: '192.168.1.101',
      port: 8000,
      protocol: 'TCP',
      connectionString: 'TCP://192.168.1.101:8000',
      settings: {
        scannerType: 'Network',
        triggerMode: 'Auto',
        encoding: 'UTF8'
      }
    }
  })

  // 为工位2创建设备
  const plcDevice2 = await prisma.device.upsert({
    where: { deviceId: 'PLC-WS002-01' },
    update: {},
    create: {
      deviceId: 'PLC-WS002-01',
      name: 'PLC控制器-工位2',
      type: DeviceType.PLC_CONTROLLER,
      brand: '西门子',
      model: 'S7-1500',
      driver: 'PlcDriver',
      description: '工位2主控PLC',
      workstationId: workstation2.id,
      ipAddress: '192.168.1.110',
      port: 102,
      protocol: 'S7',
      connectionString: 'S7://192.168.1.110:102',
      settings: {
        plcType: 'Siemens_S7',
        cpuType: 'S7_1500',
        rack: 0,
        slot: 1
      }
    }
  })

  const sensor1 = await prisma.device.upsert({
    where: { deviceId: 'SENSOR-WS002-01' },
    update: {},
    create: {
      deviceId: 'SENSOR-WS002-01',
      name: '压力传感器-工位2',
      type: DeviceType.SENSOR,
      brand: '施耐德',
      model: 'XMLP001',
      driver: 'SensorDriver',
      description: '工位2压力检测传感器',
      workstationId: workstation2.id,
      ipAddress: '192.168.1.111',
      port: 502,
      protocol: 'ModbusTCP',
      connectionString: 'ModbusTCP://192.168.1.111:502',
      settings: {
        modbusAddress: 1,
        registerAddress: 0,
        dataType: 'FLOAT'
      }
    }
  })

  console.log('创建的设备:', { 
    plcDevice1, 
    scanner1, 
    plcDevice2, 
    sensor1 
  })

  // 创建一个测试用户
  const testUser = await prisma.user.upsert({
    where: { username: 'operator01' },
    update: {},
    create: {
      username: 'operator01',
      password: 'hashed_password_here',
      email: 'operator01@company.com',
      role: 'OPERATOR'
    }
  })

  console.log('创建的测试用户:', testUser)

  console.log('测试数据创建完成!')
  console.log('工位数量:', await prisma.workstation.count())
  console.log('设备数量:', await prisma.device.count())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })