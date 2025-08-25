import { PrismaClient as SQLitePrismaClient } from '@prisma/client'
import { Client } from 'pg'
import * as fs from 'fs'

// SQLite数据库配置
const sqlitePrisma = new SQLitePrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
})

// PostgreSQL数据库配置
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/simplemes_db'
})

interface MigrationResult {
  table: string
  count: number
  success: boolean
  error?: string
}

class DatabaseMigrator {
  private results: MigrationResult[] = []

  async exportSQLiteData() {
    console.log('🔄 开始导出SQLite数据...')
    
    try {
      await sqlitePrisma.$connect()
      
      // 获取所有表的数据
      const tables = {
        permissions: await sqlitePrisma.permission.findMany(),
        roles: await sqlitePrisma.role.findMany(),
        users: await sqlitePrisma.user.findMany(),
        userRoleAssignments: await sqlitePrisma.userRoleAssignment.findMany(),
        rolePermissions: await sqlitePrisma.rolePermission.findMany(),
        clients: await sqlitePrisma.client.findMany(),
        workstations: await sqlitePrisma.workstation.findMany(),
        devices: await sqlitePrisma.device.findMany(),
        menus: await sqlitePrisma.menu.findMany(),
        workstationSessions: await sqlitePrisma.workstationSession.findMany(),
        products: await sqlitePrisma.product.findMany(),
        productWorkstations: await sqlitePrisma.productWorkstation.findMany(),
        boms: await sqlitePrisma.bOM.findMany(),
        bomItems: await sqlitePrisma.bOMItem.findMany(),
        parts: await sqlitePrisma.part.findMany(),
        processes: await sqlitePrisma.process.findMany(),
        steps: await sqlitePrisma.step.findMany(),
        stepTemplates: await sqlitePrisma.stepTemplate.findMany(),
        stepConditions: await sqlitePrisma.stepCondition.findMany(),
        actions: await sqlitePrisma.action.findMany(),
        actionTemplates: await sqlitePrisma.actionTemplate.findMany(),
        orders: await sqlitePrisma.order.findMany(),
        orderSteps: await sqlitePrisma.orderStep.findMany(),
        actionLogs: await sqlitePrisma.actionLog.findMany(),
        orderStatusHistory: await sqlitePrisma.orderStatusHistory.findMany(),
        dataExportRecords: await sqlitePrisma.dataExportRecord.findMany()
      }

      // 保存到JSON文件
      fs.writeFileSync('./prisma/sqlite_export.json', JSON.stringify(tables, null, 2))
      console.log('✅ SQLite数据导出完成，保存到 sqlite_export.json')
      
      return tables
    } catch (error) {
      console.error('❌ SQLite数据导出失败:', error)
      throw error
    } finally {
      await sqlitePrisma.$disconnect()
    }
  }

  async importToPostgreSQL(data: any) {
    console.log('🔄 开始导入数据到PostgreSQL...')
    
    try {
      await pgClient.connect()
      
      // 按依赖顺序导入数据
      const importOrder = [
        'permissions',
        'roles', 
        'users',
        'rolePermissions',
        'userRoleAssignments',
        'clients',
        'workstations',
        'devices', 
        'menus',
        'workstationSessions',
        'products',
        'productWorkstations',
        'boms',
        'bomItems',
        'parts',
        'processes',
        'stepTemplates',
        'stepConditions',
        'steps',
        'actionTemplates',
        'actions',
        'orders',
        'orderSteps',
        'actionLogs',
        'orderStatusHistory',
        'dataExportRecords'
      ]

      for (const tableName of importOrder) {
        await this.importTable(tableName, data[tableName])
      }

      console.log('✅ 所有数据导入完成')
      this.printResults()
      
    } catch (error) {
      console.error('❌ PostgreSQL数据导入失败:', error)
      throw error
    } finally {
      await pgClient.end()
    }
  }

  private async importTable(tableName: string, records: any[]) {
    if (!records || records.length === 0) {
      this.results.push({ table: tableName, count: 0, success: true })
      console.log(`⏭️  跳过空表: ${tableName}`)
      return
    }

    try {
      const tableMap = {
        permissions: 'permissions',
        roles: 'roles',
        users: 'users',
        userRoleAssignments: 'user_role_assignments',
        rolePermissions: 'role_permissions',
        clients: 'clients',
        workstations: 'workstations',
        devices: 'devices',
        menus: 'menus',
        workstationSessions: 'workstation_sessions',
        products: 'products',
        productWorkstations: 'product_workstations',
        boms: 'boms',
        bomItems: 'bom_items',
        parts: 'parts',
        processes: 'processes',
        steps: 'steps',
        stepTemplates: 'step_templates',
        stepConditions: 'step_conditions',
        actions: 'actions',
        actionTemplates: 'action_templates',
        orders: 'orders',
        orderSteps: 'order_steps',
        actionLogs: 'action_logs',
        orderStatusHistory: 'order_status_history',
        dataExportRecords: 'data_export_records'
      }

      const pgTableName = tableMap[tableName as keyof typeof tableMap] || tableName

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
          
          await pgClient.query(insertQuery, values)
          insertedCount++
        } catch (recordError) {
          console.warn(`⚠️  记录插入失败 ${tableName}:`, recordError)
        }
      }

      this.results.push({ 
        table: tableName, 
        count: insertedCount, 
        success: true 
      })
      
      console.log(`✅ ${tableName}: 导入 ${insertedCount}/${records.length} 条记录`)
      
    } catch (error) {
      this.results.push({ 
        table: tableName, 
        count: 0, 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      })
      console.error(`❌ ${tableName} 导入失败:`, error)
    }
  }

  private printResults() {
    console.log('\n📊 数据迁移结果汇总:')
    console.log('================================')
    
    let totalSuccess = 0
    let totalRecords = 0
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.table}: ${result.count} 条记录`)
      
      if (result.success) {
        totalSuccess++
        totalRecords += result.count
      }
      
      if (result.error) {
        console.log(`   错误: ${result.error}`)
      }
    })
    
    console.log('================================')
    console.log(`总计: ${totalSuccess}/${this.results.length} 个表成功，共 ${totalRecords} 条记录`)
  }
}

async function main() {
  console.log('🚀 SimpleMES 数据库迁移工具 - SQLite to PostgreSQL')
  console.log('================================================')
  
  const migrator = new DatabaseMigrator()
  
  try {
    // 1. 导出SQLite数据
    const data = await migrator.exportSQLiteData()
    
    // 2. 导入到PostgreSQL
    await migrator.importToPostgreSQL(data)
    
    console.log('\n🎉 数据迁移完成！请验证数据完整性。')
    
  } catch (error) {
    console.error('\n💥 数据迁移失败:', error)
    process.exit(1)
  }
}

// 运行迁移
if (require.main === module) {
  main()
}

export { DatabaseMigrator }