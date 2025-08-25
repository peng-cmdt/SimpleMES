const { PrismaClient } = require('@prisma/client')

async function debugDeviceIssue() {
  const prisma = new PrismaClient()
  
  try {
    // 查找所有包含 "cmejepps" 的设备
    const devices = await prisma.device.findMany({
      where: {
        id: {
          contains: 'cmejepps'
        }
      },
      include: {
        workstation: true,
        actionLogs: true,
        actions: true
      }
    })
    
    console.log('找到的相关设备:')
    devices.forEach(device => {
      console.log(`ID: ${device.id}`)
      console.log(`名称: ${device.name}`)
      console.log(`工位: ${device.workstation?.name || '未分配'}`)
      console.log(`ActionLogs: ${device.actionLogs.length}`)
      console.log(`Actions: ${device.actions.length}`)
      console.log('---')
    })
    
    // 查看所有设备
    const allDevices = await prisma.device.findMany({
      select: { id: true, name: true }
    })
    
    console.log('\\n所有设备列表:')
    allDevices.forEach(d => {
      console.log(`${d.name}: ${d.id}`)
    })
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('错误:', error.message)
    await prisma.$disconnect()
  }
}

debugDeviceIssue()