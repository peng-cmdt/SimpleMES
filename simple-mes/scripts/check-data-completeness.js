const { PrismaClient } = require('@prisma/client')

async function checkDataCompleteness() {
  console.log('🔍 检查PostgreSQL数据库数据完整性')
  console.log('=====================================')

  const prisma = new PrismaClient()

  try {
    // 检查所有主要表的数据量
    const tables = [
      'user', 'role', 'permission', 'userRoleAssignment', 'rolePermission',
      'client', 'workstation', 'device', 'menu', 'workstationSession',
      'product', 'productWorkstation', 'bOM', 'bOMItem', 'part',
      'process', 'step', 'stepTemplate', 'stepCondition',
      'action', 'actionTemplate', 'order', 'orderStep', 'actionLog', 'orderStatusHistory',
      'dataExportRecord'
    ]

    console.log('\n📊 当前数据库表记录统计:')
    console.log('==========================')
    
    let totalRecords = 0
    const tableData = {}
    
    for (const table of tables) {
      try {
        const count = await prisma[table].count()
        totalRecords += count
        tableData[table] = count
        
        const status = count > 0 ? '✅' : '❌'
        console.log(`${status} ${table}: ${count} 条记录`)
      } catch (error) {
        console.log(`❌ ${table}: 查询失败 - ${error.message.split('\n')[0]}`)
      }
    }
    
    console.log('==========================')
    console.log(`📈 总记录数: ${totalRecords}`)

    // 检查关键业务数据详情
    console.log('\n🔍 关键业务数据详细检查:')
    console.log('=========================')

    // 1. 用户数据
    const users = await prisma.user.findMany()
    console.log(`\n👥 用户数据 (${users.length}个):`)
    if (users.length === 0) {
      console.log('❌ 没有用户数据！这表明数据迁移不完整。')
    } else {
      users.forEach(user => {
        console.log(`   - ${user.username} (${user.role})`)
      })
    }

    // 2. 产品数据
    const products = await prisma.product.findMany()
    console.log(`\n📦 产品数据 (${products.length}个):`)
    if (products.length === 0) {
      console.log('❌ 没有产品数据！')
    } else {
      products.forEach(product => {
        console.log(`   - ${product.name} (${product.productCode})`)
      })
    }

    // 3. 工艺流程数据
    const processes = await prisma.process.findMany()
    console.log(`\n⚙️  工艺流程数据 (${processes.length}个):`)
    if (processes.length === 0) {
      console.log('❌ 没有工艺流程数据！')
    } else {
      processes.forEach(process => {
        console.log(`   - ${process.name} (版本: ${process.version})`)
      })
    }

    // 4. BOM数据
    const boms = await prisma.bOM.findMany()
    console.log(`\n📋 BOM数据 (${boms.length}个):`)
    if (boms.length === 0) {
      console.log('❌ 没有BOM数据！')
    } else {
      boms.forEach(bom => {
        console.log(`   - ${bom.name} (${bom.bomCode})`)
      })
    }

    // 5. 订单数据
    const orders = await prisma.order.findMany()
    console.log(`\n📄 订单数据 (${orders.length}个):`)
    if (orders.length === 0) {
      console.log('❌ 没有订单数据！')
    } else {
      orders.forEach(order => {
        console.log(`   - ${order.orderNumber} (${order.status})`)
      })
    }

    // 6. 权限系统数据
    const permissions = await prisma.permission.findMany()
    const roles = await prisma.role.findMany()
    console.log(`\n🔐 权限系统数据:`)
    console.log(`   权限: ${permissions.length}个`)
    console.log(`   角色: ${roles.length}个`)
    if (permissions.length === 0 || roles.length === 0) {
      console.log('❌ 权限系统数据不完整！')
    }

    await prisma.$disconnect()

    // 分析结果
    console.log('\n🎯 数据完整性分析:')
    console.log('==================')
    
    const emptyTables = Object.entries(tableData).filter(([table, count]) => count === 0)
    const nonEmptyTables = Object.entries(tableData).filter(([table, count]) => count > 0)
    
    console.log(`✅ 有数据的表: ${nonEmptyTables.length}个`)
    console.log(`❌ 空表: ${emptyTables.length}个`)
    
    if (emptyTables.length > 0) {
      console.log('\n❌ 空表列表:')
      emptyTables.forEach(([table]) => {
        console.log(`   - ${table}`)
      })
    }

    if (totalRecords < 100) {
      console.log('\n🚨 警告: 数据总量过少，可能存在迁移不完整的问题！')
      console.log('   建议重新进行完整的数据迁移。')
      return false
    } else {
      console.log('\n✅ 数据量看起来合理')
      return true
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message)
    await prisma.$disconnect()
    return false
  }
}

if (require.main === module) {
  checkDataCompleteness()
}