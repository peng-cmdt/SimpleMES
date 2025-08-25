const { Client } = require('pg')

async function createDatabaseIfNotExists() {
  // 连接到默认的postgres数据库来创建目标数据库
  const adminClient = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres', 
    password: 'password',
    port: 5432,
  })

  try {
    console.log('🔄 连接到PostgreSQL管理数据库...')
    await adminClient.connect()
    console.log('✅ 成功连接到PostgreSQL')

    // 检查目标数据库是否存在
    const checkResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'simplemes_db'"
    )

    if (checkResult.rows.length === 0) {
      console.log('🔄 创建目标数据库 simplemes_db...')
      await adminClient.query('CREATE DATABASE simplemes_db')
      console.log('✅ 数据库 simplemes_db 创建成功')
    } else {
      console.log('ℹ️  数据库 simplemes_db 已存在')
    }

    await adminClient.end()
    return true

  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message)
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 解决建议:')
      console.log('1. 确认PostgreSQL服务正在运行')
      console.log('2. 检查端口5432是否可用')
      console.log('3. 确认防火墙设置')
    } else if (error.code === '28P01') {
      console.log('\n💡 解决建议:')
      console.log('1. 检查用户名和密码是否正确')
      console.log('2. 确认PostgreSQL用户权限')
      console.log('3. 检查pg_hba.conf配置')
    }
    
    return false
  } finally {
    try {
      await adminClient.end()
    } catch (e) {
      // 忽略关闭连接的错误
    }
  }
}

async function testTargetDatabaseConnection() {
  const targetClient = new Client({
    connectionString: 'postgresql://postgres:password@localhost:5432/simplemes_db'
  })

  try {
    console.log('🔄 测试目标数据库连接...')
    await targetClient.connect()
    
    // 测试基本查询
    const result = await targetClient.query('SELECT current_database(), version()')
    console.log('✅ 目标数据库连接成功')
    console.log(`   数据库: ${result.rows[0].current_database}`)
    console.log(`   版本: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`)
    
    await targetClient.end()
    return true

  } catch (error) {
    console.error('❌ 目标数据库连接失败:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 PostgreSQL数据库环境检测')
  console.log('===========================')

  // 第一步：创建数据库
  const createSuccess = await createDatabaseIfNotExists()
  if (!createSuccess) {
    console.log('\n❌ 数据库创建失败，请检查PostgreSQL配置')
    process.exit(1)
  }

  console.log('')

  // 第二步：测试目标数据库连接
  const testSuccess = await testTargetDatabaseConnection()
  if (!testSuccess) {
    console.log('\n❌ 目标数据库连接测试失败')
    process.exit(1)
  }

  console.log('')
  console.log('🎉 PostgreSQL环境检测完成！')
  console.log('可以继续执行数据库迁移...')
}

if (require.main === module) {
  main()
}