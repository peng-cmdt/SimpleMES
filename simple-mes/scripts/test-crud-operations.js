const { PrismaClient } = require('@prisma/client')

async function testCRUDOperations() {
  console.log('🧪 PostgreSQL CRUD操作完整测试')
  console.log('==============================')

  const prisma = new PrismaClient()

  try {
    // 1. CREATE - 创建新用户
    console.log('\n1️⃣ 测试CREATE操作...')
    const newUser = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        password: 'test123',
        email: 'test@example.com',
        role: 'OPERATOR'
      }
    })
    console.log(`✅ 创建用户成功: ${newUser.username} (ID: ${newUser.id})`)

    // 2. READ - 读取用户数据
    console.log('\n2️⃣ 测试READ操作...')
    const users = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { username: true, role: true, createdAt: true }
    })
    console.log(`✅ 读取ADMIN用户: ${users.length} 个`)
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.role})`)
    })

    // 3. UPDATE - 更新用户数据
    console.log('\n3️⃣ 测试UPDATE操作...')
    const updatedUser = await prisma.user.update({
      where: { id: newUser.id },
      data: { email: 'updated@example.com', status: 'inactive' }
    })
    console.log(`✅ 更新用户成功: ${updatedUser.username} - 新邮箱: ${updatedUser.email}`)

    // 4. 测试关联查询 (JOIN)
    console.log('\n4️⃣ 测试关联查询...')
    const workstationsWithDevices = await prisma.workstation.findMany({
      include: {
        devices: {
          select: { name: true, type: true, status: true }
        }
      }
    })
    console.log(`✅ 工位和设备关联查询: ${workstationsWithDevices.length} 个工位`)
    workstationsWithDevices.forEach(ws => {
      console.log(`   - ${ws.name}: ${ws.devices.length} 个设备`)
    })

    // 5. 测试复杂查询
    console.log('\n5️⃣ 测试复杂业务查询...')
    const ordersWithProducts = await prisma.order.findMany({
      include: {
        product: {
          select: { name: true, productCode: true }
        }
      },
      take: 3
    })
    console.log(`✅ 订单和产品关联查询: ${ordersWithProducts.length} 个订单`)
    ordersWithProducts.forEach(order => {
      console.log(`   - ${order.orderNumber}: ${order.product?.name} (数量: ${order.quantity})`)
    })

    // 6. 测试枚举值
    console.log('\n6️⃣ 测试枚举值操作...')
    const roleDistribution = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    })
    console.log('✅ 用户角色分布:')
    roleDistribution.forEach(group => {
      console.log(`   - ${group.role}: ${group._count.role} 个用户`)
    })

    // 7. 测试事务操作
    console.log('\n7️⃣ 测试事务操作...')
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: `测试产品_${Date.now()}`,
          productCode: `TEST_${Date.now()}`,
          description: '事务测试产品',
          version: '1.0'
        }
      })
      
      const order = await tx.order.create({
        data: {
          orderNumber: `ORDER_${Date.now()}`,
          productionNumber: `PROD_${Date.now()}`,
          productId: product.id,
          processId: 'cmejg634v000ztmy8av9bwyli', // 使用现有的工艺ID
          quantity: 100,
          status: 'PENDING',
          priority: 1
        }
      })
      
      return { product, order }
    })
    console.log(`✅ 事务操作成功: 产品 ${result.product.name} 和订单 ${result.order.orderNumber}`)

    // 8. DELETE - 清理测试数据
    console.log('\n8️⃣ 测试DELETE操作...')
    await prisma.user.delete({ where: { id: newUser.id } })
    await prisma.order.delete({ where: { id: result.order.id } })
    await prisma.product.delete({ where: { id: result.product.id } })
    console.log('✅ 清理测试数据成功')

    await prisma.$disconnect()

    console.log('\n🎯 CRUD操作测试结果:')
    console.log('====================')
    console.log('✅ CREATE操作正常')
    console.log('✅ READ操作正常')
    console.log('✅ UPDATE操作正常')
    console.log('✅ DELETE操作正常')
    console.log('✅ 关联查询正常')
    console.log('✅ 枚举值处理正常')
    console.log('✅ 事务操作正常')
    console.log('✅ PostgreSQL数据库完全正常!')

    return true

  } catch (error) {
    console.error('❌ CRUD操作失败:', error.message)
    await prisma.$disconnect()
    return false
  }
}

if (require.main === module) {
  testCRUDOperations()
}