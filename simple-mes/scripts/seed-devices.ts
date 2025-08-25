import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedDevices() {
  try {
    // 先获取一个客户端
    const client = await prisma.client.findFirst()
    
    if (!client) {
      console.log('没有找到客户端，请先创建客户端')
      return
    }

    // 创建示例设备
    const devices = [
      {
        deviceId: 'PLC-001',
        name: 'PLC控制器-001',
        type: 'PLC_CONTROLLER',
        brand: '西门子',
        model: 'S7-1200',
        description: '主控PLC，负责生产线控制',
        clientId: client.id,
        ipAddress: '192.168.1.101',
        port: 502,
        protocol: 'Modbus',
        connectionString: 'unit=1',
        status: 'OFFLINE',
        isOnline: false
      },
      {
        deviceId: 'SCREWDRIVER-001',
        name: '螺丝刀控制器-001',
        type: 'SCREWDRIVER',
        brand: '阿特拉斯',
        model: 'ETP ST61',
        description: '电动螺丝刀控制器',
        clientId: client.id,
        ipAddress: '192.168.1.102',
        port: 4545,
        protocol: 'TCP',
        status: 'OFFLINE',
        isOnline: false
      },
      {
        deviceId: 'SCANNER-001',
        name: '基恩士扫码枪-001',
        type: 'BARCODE_SCANNER',
        brand: '基恩士',
        model: 'SR-1000',
        description: '二维码扫描器',
        clientId: client.id,
        ipAddress: '192.168.1.103',
        port: 8080,
        protocol: 'HTTP',
        connectionString: '/api/scan',
        status: 'OFFLINE',
        isOnline: false
      }
    ]

    for (const deviceData of devices) {
      const existingDevice = await prisma.device.findUnique({
        where: { deviceId: deviceData.deviceId }
      })

      if (!existingDevice) {
        await prisma.device.create({
          data: deviceData
        })
        console.log(`创建设备: ${deviceData.name}`)
      } else {
        console.log(`设备已存在: ${deviceData.name}`)
      }
    }

    console.log('设备初始化完成')
  } catch (error) {
    console.error('设备初始化失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedDevices()