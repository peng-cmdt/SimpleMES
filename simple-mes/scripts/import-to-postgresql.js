const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// PostgreSQL连接配置
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/simplemes_db'
})

// 表映射：JSON key -> PostgreSQL table name
const tableMap = {
  permissions: 'permissions',
  roles: 'roles',
  users: 'users',
  user_role_assignments: 'user_role_assignments',
  role_permissions: 'role_permissions',
  clients: 'clients',
  workstations: 'workstations',
  devices: 'devices',
  menus: 'menus',
  workstation_sessions: 'workstation_sessions',
  products: 'products',
  product_workstations: 'product_workstations',
  boms: 'boms',
  bom_items: 'bom_items',
  parts: 'parts',
  processes: 'processes',
  step_templates: 'step_templates',
  step_conditions: 'step_conditions',
  steps: 'steps',
  action_templates: 'action_templates',
  actions: 'actions',
  orders: 'orders',
  order_steps: 'order_steps',
  action_logs: 'action_logs',
  order_status_history: 'order_status_history',
  data_export_records: 'data_export_records'
}

// 导入顺序（按依赖关系排序）
const importOrder = [
  'permissions',
  'roles', 
  'users',
  'role_permissions',
  'user_role_assignments',
  'clients',
  'workstations',
  'devices', 
  'menus',
  'workstation_sessions',
  'products',
  'product_workstations',
  'boms',
  'bom_items',
  'parts',
  'processes',
  'step_templates',
  'step_conditions',
  'steps',
  'action_templates',
  'actions',
  'orders',
  'order_steps',
  'action_logs',
  'order_status_history',
  'data_export_records'
]

async function importTable(tableName, records) {
  if (!records || records.length === 0) {
    console.log(`⏭️  跳过空表: ${tableName}`)
    return { success: true, count: 0 }
  }

  try {
    const pgTableName = tableMap[tableName] || tableName

    // 构建INSERT语句
    const columns = Object.keys(records[0])
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const columnList = columns.map(col => `"${col}"`).join(', ')
    
    const insertQuery = `INSERT INTO "${pgTableName}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`

    let insertedCount = 0
    for (const record of records) {
      try {
        const values = columns.map(col => {
          let value = record[col]
          
          // 处理日期时间格式
          if (value && typeof value === 'string' && 
              (col.endsWith('At') || col.endsWith('Time') || col.endsWith('Date'))) {
            // SQLite存储的ISO字符串转换为PostgreSQL timestamp
            value = new Date(value).toISOString()
          }
          
          // 处理JSON字段
          if (value && typeof value === 'object' && 
              (col === 'settings' || col === 'parameters' || col === 'capabilities' || 
               col === 'connectedDevices' || col === 'filters' || col === 'result')) {
            value = JSON.stringify(value)
          }
          
          return value
        })
        
        await client.query(insertQuery, values)
        insertedCount++
      } catch (recordError) {
        console.warn(`⚠️  记录插入失败 ${tableName}:`, recordError.message)
      }
    }

    console.log(`✅ ${tableName}: 导入 ${insertedCount}/${records.length} 条记录`)
    return { success: true, count: insertedCount }
    
  } catch (error) {
    console.error(`❌ ${tableName} 导入失败:`, error.message)
    return { success: false, count: 0, error: error.message }
  }
}

async function main() {
  try {
    console.log('🔄 开始导入数据到PostgreSQL...')
    
    // 连接到PostgreSQL
    await client.connect()
    console.log('✅ 连接到PostgreSQL数据库')
    
    // 读取导出的数据
    const exportPath = path.join(__dirname, '../prisma/sqlite_export.json')
    if (!fs.existsSync(exportPath)) {
      throw new Error(`导出文件不存在: ${exportPath}`)
    }
    
    const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'))
    console.log('✅ 读取SQLite导出数据')
    
    // 按顺序导入数据
    const results = []
    for (const tableName of importOrder) {
      const records = data[tableName]
      const result = await importTable(tableName, records)
      results.push({ table: tableName, ...result })
    }
    
    // 统计结果
    console.log('\n📊 数据导入结果汇总:')
    console.log('================================')
    
    let totalSuccess = 0
    let totalRecords = 0
    let totalFailed = 0
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.table}: ${result.count} 条记录`)
      
      if (result.success) {
        totalSuccess++
        totalRecords += result.count
      } else {
        totalFailed++
        if (result.error) {
          console.log(`   错误: ${result.error}`)
        }
      }
    })
    
    console.log('================================')
    console.log(`总计: ${totalSuccess}/${results.length} 个表成功，共 ${totalRecords} 条记录`)
    
    if (totalFailed > 0) {
      console.log(`⚠️  ${totalFailed} 个表导入失败`)
    }
    
    console.log('\n🎉 数据导入完成！')
    
  } catch (error) {
    console.error('❌ 数据导入失败:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

if (require.main === module) {
  main()
}