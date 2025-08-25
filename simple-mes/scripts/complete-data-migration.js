const sqlite3 = require('sqlite3').verbose()
const { Client } = require('pg')

async function completeDataMigration() {
  console.log('🚀 开始完整数据重新迁移')
  console.log('========================')
  console.log('⚠️  这将清空PostgreSQL数据并重新导入SQLite数据')
  
  // PostgreSQL连接
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/simplemes_db'
  })

  try {
    await pgClient.connect()
    console.log('✅ 连接PostgreSQL成功')

    // 1. 清空所有数据表（保留结构）
    console.log('\n🧹 清空PostgreSQL数据表...')
    const tables = [
      'action_logs', 'order_steps', 'actions', 'action_templates',
      'step_conditions', 'steps', 'step_templates', 'processes',
      'orders', 'order_status_history', 'bom_items', 'boms', 
      'product_workstations', 'products', 'parts',
      'workstation_sessions', 'devices', 'workstations', 'clients',
      'menus', 'data_export_records',
      'user_role_assignments', 'role_permissions', 'users', 'roles', 'permissions'
    ]

    // 禁用外键约束
    await pgClient.query('SET session_replication_role = replica;')
    
    for (const table of tables) {
      try {
        await pgClient.query(`DELETE FROM "${table}"`)
        console.log(`   ✅ 清空表: ${table}`)
      } catch (error) {
        console.log(`   ⚠️  跳过表: ${table} (${error.message.split('\n')[0]})`)
      }
    }

    // 重启序列
    await pgClient.query(`
      DO $$ 
      DECLARE 
          r RECORD;
      BEGIN 
          FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') 
          LOOP
              EXECUTE 'ALTER SEQUENCE IF EXISTS ' || quote_ident(r.schemaname||'_'||r.tablename||'_id_seq') || ' RESTART WITH 1';
          END LOOP;
      END $$;
    `)

    // 2. 从SQLite导入数据
    console.log('\n📥 开始从SQLite导入数据...')
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database('./archive_sqlite_backup/dev.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`无法打开SQLite数据库: ${err.message}`))
          return
        }
      })

      // 导入顺序很重要，需要按照外键依赖顺序导入
      const importOrder = [
        'permissions',
        'roles', 
        'users',
        'role_permissions',
        'user_role_assignments',
        'clients',
        'menus',
        'workstations',
        'devices',
        'workstation_sessions',
        'products',
        'product_workstations',
        'boms',
        'bom_items',
        'parts',
        'processes',
        'step_templates',
        'steps',
        'step_conditions',
        'action_templates',
        'actions',
        'orders',
        'order_steps',
        'order_status_history',
        'action_logs',
        'data_export_records'
      ]

      async function importTable(tableName) {
        return new Promise((resolveTable, rejectTable) => {
          db.all(`SELECT * FROM "${tableName}"`, [], async (err, rows) => {
            if (err) {
              console.log(`   ❌ 读取表 ${tableName} 失败: ${err.message}`)
              resolveTable(0)
              return
            }

            if (rows.length === 0) {
              console.log(`   ⚠️  表 ${tableName} 无数据`)
              resolveTable(0)
              return
            }

            try {
              let insertedCount = 0
              
              for (const row of rows) {
                // 构建插入语句
                const columns = Object.keys(row).map(col => `"${col}"`).join(', ')
                const placeholders = Object.keys(row).map((_, i) => `$${i + 1}`).join(', ')
                const values = Object.values(row).map((val, index) => {
                  if (val === null) return null
                  if (typeof val === 'boolean') return val
                  if (typeof val === 'number') return val
                  if (typeof val === 'string') {
                    const columnName = Object.keys(row)[index]
                    
                    // 特殊处理时间戳类型的列
                    if (columnName.includes('At') || columnName.includes('Time') || columnName.includes('Date')) {
                      // 处理13位时间戳
                      if (val.match(/^\\d{13}$/)) {
                        const timestamp = parseInt(val)
                        // 如果时间戳过大，设为默认时间
                        if (timestamp > Date.now() || timestamp < 946684800000) { // 2000-01-01
                          console.log(`     ⚠️  时间戳超出合理范围 ${val} (列: ${columnName}), 替换为当前时间`)
                          return new Date().toISOString()
                        }
                        try {
                          return new Date(timestamp).toISOString()
                        } catch (error) {
                          console.log(`     ⚠️  时间戳转换失败 ${val} (列: ${columnName}), 替换为当前时间`)
                          return new Date().toISOString()
                        }
                      }
                      // 处理ISO日期字符串
                      if (val.match(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/)) {
                        try {
                          const date = new Date(val)
                          if (date.getFullYear() < 2000 || date.getFullYear() > 2030) {
                            console.log(`     ⚠️  日期超出合理范围 ${val} (列: ${columnName}), 替换为当前时间`)
                            return new Date().toISOString()
                          }
                          return date.toISOString()
                        } catch (error) {
                          console.log(`     ⚠️  日期格式转换失败 ${val} (列: ${columnName}), 替换为当前时间`)
                          return new Date().toISOString()
                        }
                      }
                    }
                    
                    // 对于非时间字段，直接返回字符串值
                    return val
                  }
                  return val
                })

                const insertQuery = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`
                
                try {
                  await pgClient.query(insertQuery, values)
                  insertedCount++
                } catch (insertError) {
                  // 如果是重复键错误，跳过
                  if (insertError.code !== '23505') {
                    console.log(`     ⚠️  插入失败: ${insertError.message.split('\n')[0]}`)
                  }
                }
              }
              
              console.log(`   ✅ 导入表 ${tableName}: ${insertedCount}/${rows.length} 条记录`)
              resolveTable(insertedCount)
              
            } catch (importError) {
              console.log(`   ❌ 导入表 ${tableName} 失败: ${importError.message}`)
              resolveTable(0)
            }
          })
        })
      }

      async function importAllTables() {
        let totalImported = 0
        
        for (const tableName of importOrder) {
          const imported = await importTable(tableName)
          totalImported += imported
        }

        // 恢复外键约束
        await pgClient.query('SET session_replication_role = DEFAULT;')
        
        console.log(`\n🎯 数据导入完成! 总计导入 ${totalImported} 条记录`)
        
        db.close()
        await pgClient.end()
        
        resolve(totalImported)
      }

      importAllTables().catch(reject)
    })

  } catch (error) {
    console.error('❌ 迁移失败:', error.message)
    await pgClient.end()
    throw error
  }
}

if (require.main === module) {
  completeDataMigration()
    .then(totalRecords => {
      console.log(`\n🎉 完整数据迁移成功! 导入了 ${totalRecords} 条记录`)
      console.log('\n📋 建议运行验证脚本确认数据完整性')
    })
    .catch(error => {
      console.error('❌ 迁移过程失败:', error.message)
      process.exit(1)
    })
}