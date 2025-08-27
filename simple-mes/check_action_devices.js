const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== 检查Action表中的设备关联 ===')
  
  const actions = await prisma.action.findMany({
    include: {
      device: true,
      step: {
        include: {
          stepTemplate: true
        }
      }
    }
  })
  
  console.log(`总共找到 ${actions.length} 个动作`)
  
  actions.forEach((action, index) => {
    console.log(`\n--- Action ${index + 1} ---`)
    console.log(`名称: ${action.name}`)
    console.log(`类型: ${action.type}`)
    console.log(`设备ID: ${action.deviceId || '未设置'}`)
    console.log(`设备信息: ${action.device ? action.device.name : '无关联设备'}`)
    console.log(`步骤: ${action.step.name}`)
    console.log(`设备地址: ${action.deviceAddress || '未设置'}`)
  })
  
  // 检查设备表
  console.log('\n=== 设备表信息 ===')
  const devices = await prisma.device.findMany()
  devices.forEach(device => {
    console.log(`设备: ${device.name} (ID: ${device.deviceId}, 类型: ${device.type})`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
