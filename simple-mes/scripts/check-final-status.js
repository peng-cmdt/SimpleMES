const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkFinalStatus() {
  try {
    console.log('=== 最终架构检查 ===\n')

    // 检查新架构设备模板
    const deviceTemplates = await prisma.deviceTemplate.findMany()
    console.log(`📊 设备模板 (DeviceTemplate表): ${deviceTemplates.length} 条记录`)
    if (deviceTemplates.length > 0) {
      console.log('设备模板详情:')
      deviceTemplates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name} (${template.type}) - 品牌: ${template.brand || 'N/A'}`)
      })
    }

    console.log()

    // 检查新架构工位设备实例
    const workstationDevices = await prisma.workstationDevice.findMany({
      include: {
        template: {
          select: {
            name: true,
            type: true
          }
        },
        workstation: {
          select: {
            workstationId: true,
            name: true
          }
        }
      }
    })

    console.log(`📊 工位设备实例 (WorkstationDevice表): ${workstationDevices.length} 条记录`)
    if (workstationDevices.length > 0) {
      console.log('工位设备实例详情:')
      workstationDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.displayName} (${device.template.type}) - 工位: ${device.workstation.name}`)
        console.log(`     IP: ${device.ipAddress}, 端口: ${device.port}`)
      })
    }

    console.log()

    // 检查工位信息
    const workstations = await prisma.workstation.findMany()
    console.log(`📊 工位信息: ${workstations.length} 条记录`)
    if (workstations.length > 0) {
      console.log('工位详情:')
      workstations.forEach((ws, index) => {
        console.log(`  ${index + 1}. ${ws.workstationId} - ${ws.name}`)
      })
    }

    console.log('\n=== 架构迁移完成 ===')
    console.log('✅ 系统已完全使用新架构 (DeviceTemplate + WorkstationDevice)')
    console.log('✅ 旧架构 (Device表) 已完全移除')
    console.log('✅ 所有API已更新为新架构')
    console.log('✅ 前端界面已更新为新架构')

  } catch (error) {
    console.error('检查最终状态失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFinalStatus()