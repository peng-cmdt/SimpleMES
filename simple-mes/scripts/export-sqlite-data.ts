import sqlite3 from 'sqlite3'
import * as fs from 'fs'
import * as path from 'path'

const dbPath = path.join(__dirname, '../prisma/dev.db')

// 所有需要导出的表，按依赖顺序排列
const tables = [
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

function exportSQLiteData(): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err)
        return
      }
      console.log('✅ 连接到SQLite数据库')
    })

    const exportedData: any = {}
    let completedTables = 0

    if (tables.length === 0) {
      resolve(exportedData)
      return
    }

    tables.forEach(tableName => {
      const query = `SELECT * FROM ${tableName}`
      
      db.all(query, [], (err, rows) => {
        if (err) {
          console.warn(`⚠️  表 ${tableName} 导出失败:`, err.message)
          exportedData[tableName] = []
        } else {
          exportedData[tableName] = rows
          console.log(`✅ 导出表 ${tableName}: ${rows.length} 条记录`)
        }
        
        completedTables++
        
        if (completedTables === tables.length) {
          db.close((closeErr) => {
            if (closeErr) {
              console.warn('⚠️  关闭数据库连接时出错:', closeErr.message)
            } else {
              console.log('✅ SQLite数据库连接已关闭')
            }
            resolve(exportedData)
          })
        }
      })
    })
  })
}

async function main() {
  try {
    console.log('🔄 开始导出SQLite数据...')
    
    // 检查数据库文件是否存在
    if (!fs.existsSync(dbPath)) {
      throw new Error(`SQLite数据库文件不存在: ${dbPath}`)
    }
    
    const data = await exportSQLiteData()
    
    // 保存到JSON文件
    const exportPath = path.join(__dirname, '../prisma/sqlite_export.json')
    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2))
    
    // 统计信息
    let totalRecords = 0
    let tablesWithData = 0
    
    Object.entries(data).forEach(([tableName, records]) => {
      const recordCount = (records as any[]).length
      totalRecords += recordCount
      if (recordCount > 0) {
        tablesWithData++
      }
    })
    
    console.log('\n📊 导出统计:')
    console.log('================================')
    console.log(`总表数: ${tables.length}`)
    console.log(`有数据的表: ${tablesWithData}`)
    console.log(`总记录数: ${totalRecords}`)
    console.log(`导出文件: ${exportPath}`)
    console.log('================================')
    
    console.log('✅ SQLite数据导出完成!')
    
  } catch (error) {
    console.error('❌ 数据导出失败:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}