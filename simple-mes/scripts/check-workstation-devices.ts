import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWorkstationDevices() {
  console.log('=== 检查工位和设备关联关系 ===\n')

  // 检查所有工位
  const workstations = await prisma.workstation.findMany({
    include: {
      devices: true
    }
  })

  console.log('工位列表:')
  workstations.forEach(ws => {
    console.log(`- ${ws.name} (${ws.workstationId}): ${ws.devices.length} 个设备`)
    ws.devices.forEach(device => {
      console.log(`  - ${device.name} (${device.deviceId}) - ${device.type}`)
    })
  })

  console.log('\n=== 检查设备详情 ===\n')
  
  // 检查所有设备
  const devices = await prisma.device.findMany({
    include: {
      workstation: true
    }
  })

  devices.forEach(device => {
    console.log(`设备: ${device.name} (${device.deviceId})`)
    console.log(`  类型: ${device.type}`)
    console.log(`  工位ID: ${device.workstationId || 'null'}`)
    console.log(`  关联工位: ${device.workstation?.name || '无'}`)
    console.log(`  IP: ${device.ipAddress}:${device.port}`)
    console.log(`  状态: ${device.status}`)
    console.log(``)
  })

  // 检查WS002工位的设备
  console.log('=== 检查WS002工位设备 ===\n')
  const ws002 = await prisma.workstation.findUnique({
    where: { workstationId: 'WS002' },
    include: { devices: true }
  })

  if (ws002) {
    console.log(`WS002 工位: ${ws002.name}`)
    console.log(`内部ID: ${ws002.id}`)
    console.log(`设备数量: ${ws002.devices.length}`)
    ws002.devices.forEach(device => {
      console.log(`  - ${device.name}: ${device.deviceId}`)
    })
  } else {
    console.log('WS002 工位不存在！')
  }
}

checkWorkstationDevices()
  .catch(console.error)
  .finally(() => prisma.$disconnect())