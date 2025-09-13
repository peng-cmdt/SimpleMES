import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDatabaseStatus() {
  try {
    console.log('=== 数据库状态检查 ===\n')

    // 检查旧架构设备数据
    const legacyDevices = await prisma.device.findMany({
      include: {
        workstation: {
          select: {
            id: true,
            workstationId: true,
            name: true
          }
        }
      }
    })

    console.log(`📊 旧架构设备 (Device表): ${legacyDevices.length} 条记录`)
    if (legacyDevices.length > 0) {
      console.log('旧架构设备详情:')
      legacyDevices.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name} (${device.type}) - 工位: ${device.workstation?.name || '未分配'}`)
        console.log(`     IP: ${device.ipAddress || 'N/A'}, 端口: ${device.port || 'N/A'}`)
      })
    }

    console.log()

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

    console.log(`📊 新架构设备实例 (WorkstationDevice表): ${workstationDevices.length} 条记录`)
    if (workstationDevices.length > 0) {
      console.log('新架构设备实例详情:')
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

    // 分析需要迁移的数据
    console.log('\n=== 迁移分析 ===')
    if (legacyDevices.length > 0 && workstationDevices.length > 0) {
      console.log('❗ 检测到同时存在新旧架构数据，需要统一到新架构')
    } else if (legacyDevices.length > 0) {
      console.log('📋 只有旧架构数据，需要全部迁移到新架构')
    } else if (workstationDevices.length > 0) {
      console.log('✅ 只有新架构数据，无需迁移')
    } else {
      console.log('📭 没有设备数据')
    }

  } catch (error) {
    console.error('检查数据库状态失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabaseStatus()