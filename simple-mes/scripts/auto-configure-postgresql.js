const { Client } = require('pg')

// 尝试不同的连接配置
const connectionConfigs = [
  {
    name: '默认postgres用户',
    config: {
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: 'postgres',
      port: 5432,
    }
  },
  {
    name: 'Windows集成认证',
    config: {
      host: 'localhost',
      database: 'postgres',
      port: 5432,
    }
  },
  {
    name: '空密码postgres',
    config: {
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: '',
      port: 5432,
    }
  }
]

async function tryConnection(configInfo) {
  const client = new Client(configInfo.config)
  
  try {
    console.log(`🔄 尝试连接: ${configInfo.name}...`)
    await client.connect()
    
    const result = await client.query('SELECT current_database(), current_user')
    console.log(`✅ 连接成功！`)
    console.log(`   数据库: ${result.rows[0].current_database}`)
    console.log(`   用户: ${result.rows[0].current_user}`)
    
    await client.end()
    return configInfo.config
  } catch (error) {
    console.log(`❌ 连接失败: ${error.message}`)
    return null
  }
}

async function createDatabase(workingConfig) {
  const client = new Client(workingConfig)
  
  try {
    await client.connect()
    
    // 检查数据库是否存在
    const checkResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'simplemes_db'"
    )
    
    if (checkResult.rows.length === 0) {
      console.log('🔄 创建数据库 simplemes_db...')
      await client.query('CREATE DATABASE simplemes_db')
      console.log('✅ 数据库创建成功')
    } else {
      console.log('ℹ️  数据库 simplemes_db 已存在')
    }
    
    await client.end()
    return true
  } catch (error) {
    console.error('❌ 创建数据库失败:', error.message)
    return false
  }
}

async function generateConnectionString(workingConfig) {
  let connectionString = 'postgresql://'
  
  if (workingConfig.user) {
    connectionString += workingConfig.user
    if (workingConfig.password) {
      connectionString += ':' + workingConfig.password
    }
    connectionString += '@'
  }
  
  connectionString += `${workingConfig.host}:${workingConfig.port}/simplemes_db`
  
  return connectionString
}

async function main() {
  console.log('🚀 PostgreSQL连接配置检测')
  console.log('==========================')
  
  let workingConfig = null
  
  // 尝试不同的连接配置
  for (const configInfo of connectionConfigs) {
    workingConfig = await tryConnection(configInfo)
    if (workingConfig) {
      break
    }
    console.log('')
  }
  
  if (!workingConfig) {
    console.log('\n❌ 所有连接尝试都失败了')
    console.log('\n💡 手动配置步骤:')
    console.log('1. 找到PostgreSQL安装目录下的 pg_hba.conf 文件')
    console.log('2. 添加或修改以下行（允许本地连接）:')
    console.log('   host    all             all             127.0.0.1/32            trust')
    console.log('3. 重启PostgreSQL服务')
    console.log('4. 或者设置postgres用户密码:')
    console.log('   ALTER USER postgres PASSWORD \'your_password\';')
    return
  }
  
  console.log('\n✅ 找到有效连接配置')
  
  // 创建目标数据库
  const createSuccess = await createDatabase(workingConfig)
  if (!createSuccess) {
    return
  }
  
  // 生成连接字符串
  const connectionString = await generateConnectionString(workingConfig)
  console.log('\n📝 请使用以下连接字符串更新 .env 文件:')
  console.log(`DATABASE_URL="${connectionString}"`)
  
  // 保存连接配置到文件
  const envContent = `# PostgreSQL Database Configuration
# Auto-detected configuration
DATABASE_URL="${connectionString}"

# Backup: Original SQLite configuration  
# DATABASE_URL="file:./dev.db"`

  require('fs').writeFileSync('.env', envContent)
  console.log('\n✅ .env 文件已自动更新')
  
  console.log('\n🎉 PostgreSQL环境配置完成！')
  console.log('现在可以继续执行数据库迁移了')
}

if (require.main === module) {
  main()
}