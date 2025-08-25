const { Client } = require('pg')

async function createDatabaseAndTest() {
  const adminClient = new Client({
    user: 'postgres',
    host: 'localhost', 
    database: 'postgres',
    password: 'root',
    port: 5432,
  })

  try {
    console.log('🔄 连接到PostgreSQL...')
    await adminClient.connect()
    console.log('✅ PostgreSQL连接成功')

    // 检查并创建目标数据库
    const checkResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'simplemes_db'"
    )

    if (checkResult.rows.length === 0) {
      console.log('🔄 创建数据库 simplemes_db...')
      await adminClient.query('CREATE DATABASE simplemes_db')
      console.log('✅ 数据库 simplemes_db 创建成功')
    } else {
      console.log('ℹ️  数据库 simplemes_db 已存在')
    }

    await adminClient.end()

    // 测试目标数据库连接
    console.log('\n🔄 测试目标数据库连接...')
    const targetClient = new Client({
      connectionString: 'postgresql://postgres:root@localhost:5432/simplemes_db'
    })

    await targetClient.connect()
    const result = await targetClient.query('SELECT current_database(), version()')
    console.log('✅ 目标数据库连接成功')
    console.log(`   数据库: ${result.rows[0].current_database}`)
    console.log(`   版本: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`)
    
    await targetClient.end()

    return true

  } catch (error) {
    console.error('❌ 操作失败:', error.message)
    return false
  }
}

if (require.main === module) {
  console.log('🚀 PostgreSQL数据库准备')
  console.log('=======================')
  
  createDatabaseAndTest().then(success => {
    if (success) {
      console.log('\n🎉 PostgreSQL环境准备完成！')
      console.log('现在可以继续执行schema迁移...')
    } else {
      console.log('\n❌ 环境准备失败')
      process.exit(1)
    }
  })
}