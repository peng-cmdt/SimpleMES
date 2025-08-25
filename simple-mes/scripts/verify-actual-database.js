const { PrismaClient } = require('@prisma/client')

async function verifyActualDatabase() {
  console.log('🔍 验证实际使用的数据库')
  console.log('========================')

  const prisma = new PrismaClient()

  try {
    // 1. 检查Prisma连接信息
    console.log('\n1️⃣ Prisma配置信息:')
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL}`)
    
    // 2. 执行原始SQL查询来确定数据库类型
    console.log('\n2️⃣ 数据库类型检测:')
    
    try {
      // PostgreSQL特有的查询
      const pgVersion = await prisma.$queryRaw`SELECT version();`
      console.log('✅ 连接到PostgreSQL数据库')
      console.log(`   版本: ${pgVersion[0].version}`)
      
      // 检查当前数据库名称
      const dbName = await prisma.$queryRaw`SELECT current_database();`
      console.log(`   数据库名: ${dbName[0].current_database}`)
      
    } catch (pgError) {
      console.log('❌ PostgreSQL查询失败:', pgError.message)
      
      try {
        // SQLite特有的查询  
        const sqliteVersion = await prisma.$queryRaw`SELECT sqlite_version();`
        console.log('⚠️  连接到SQLite数据库!')
        console.log(`   版本: ${sqliteVersion[0]['sqlite_version()']}`)
      } catch (sqliteError) {
        console.log('❌ SQLite查询也失败:', sqliteError.message)
      }
    }

    // 3. 检查表结构来确认数据库
    console.log('\n3️⃣ 表结构验证:')
    const userCount = await prisma.user.count()
    console.log(`用户数量: ${userCount}`)

    // 检查最近创建的用户
    const recentUsers = await prisma.user.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { username: true, role: true, createdAt: true }
    })
    console.log('最近用户:')
    recentUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.role}) - ${user.createdAt}`)
    })

    // 4. 检查数据完整性
    const tables = [
      'user', 'workstation', 'device', 'product', 'order'
    ]
    
    console.log('\n4️⃣ 数据完整性检查:')
    for (const table of tables) {
      try {
        const count = await prisma[table].count()
        console.log(`${table}: ${count} 条记录`)
      } catch (error) {
        console.log(`${table}: 查询失败 - ${error.message}`)
      }
    }

    await prisma.$disconnect()
    return true

  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message)
    await prisma.$disconnect()
    return false
  }
}

if (require.main === module) {
  verifyActualDatabase()
}