const sqlite3 = require('sqlite3').verbose()

async function checkSQLiteData() {
  console.log('🔍 检查SQLite备份数据完整性')
  console.log('===============================')

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('./archive_sqlite_backup/dev.db', sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        console.error('❌ 无法打开SQLite数据库:', err.message)
        reject(err)
        return
      }
      console.log('✅ 成功连接到SQLite备份数据库')
    })

    // 获取所有表名
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], async (err, tables) => {
      if (err) {
        console.error('❌ 获取表列表失败:', err.message)
        reject(err)
        return
      }

      console.log(`\n📊 SQLite数据库表统计 (${tables.length}个表):`)
      console.log('===============================')

      let totalRecords = 0
      let completedTables = 0

      for (const table of tables) {
        if (table.name.startsWith('sqlite_') || table.name.startsWith('_prisma_migrations')) {
          continue // 跳过系统表
        }

        db.get(`SELECT COUNT(*) as count FROM "${table.name}"`, [], (err, result) => {
          completedTables++
          
          if (err) {
            console.log(`❌ ${table.name}: 查询失败`)
          } else {
            const count = result.count
            totalRecords += count
            const status = count > 0 ? '✅' : '❌'
            console.log(`${status} ${table.name}: ${count} 条记录`)
          }

          // 所有表都查询完毕
          if (completedTables === tables.filter(t => !t.name.startsWith('sqlite_') && !t.name.startsWith('_prisma_migrations')).length) {
            console.log('===============================')
            console.log(`📈 SQLite总记录数: ${totalRecords}`)
            
            // 检查关键表的具体数据
            console.log('\n🔍 关键表数据检查:')
            console.log('==================')
            
            db.get("SELECT COUNT(*) as count FROM users", [], (err, result) => {
              if (!err) console.log(`👥 用户: ${result.count}`)
              
              db.get("SELECT COUNT(*) as count FROM products", [], (err, result) => {
                if (!err) console.log(`📦 产品: ${result.count}`)
                
                db.get("SELECT COUNT(*) as count FROM orders", [], (err, result) => {
                  if (!err) console.log(`📄 订单: ${result.count}`)
                  
                  db.get("SELECT COUNT(*) as count FROM processes WHERE name='processes'", [], (err, result) => {
                    if (err) {
                      // 尝试其他表名
                      db.get("SELECT COUNT(*) as count FROM process", [], (err, result) => {
                        if (!err) console.log(`⚙️  工艺: ${result.count}`)
                        
                        db.get("SELECT COUNT(*) as count FROM steps", [], (err, result) => {
                          if (err) {
                            db.get("SELECT COUNT(*) as count FROM step", [], (err, result) => {
                              if (!err) console.log(`🔧 步骤: ${result.count}`)
                              finishCheck()
                            })
                          } else {
                            console.log(`🔧 步骤: ${result.count}`)
                            finishCheck()
                          }
                        })
                      })
                    } else {
                      console.log(`⚙️  工艺: ${result.count}`)
                      finishCheck()
                    }
                  })
                })
              })
            })
            
            function finishCheck() {
              db.close((err) => {
                if (err) {
                  console.error('❌ 关闭数据库失败:', err.message)
                } else {
                  console.log('\n✅ SQLite数据检查完成')
                }
                
                if (totalRecords > 300) {
                  console.log('\n🎯 SQLite数据库包含丰富的数据，建议重新迁移！')
                  resolve(true)
                } else {
                  console.log('\n⚠️  SQLite数据量较少，请确认是否为正确的备份')
                  resolve(false)
                }
              })
            }
          }
        })
      }
    })
  })
}

if (require.main === module) {
  checkSQLiteData()
    .then(result => {
      if (result) {
        console.log('\n📋 建议执行完整数据重新迁移')
      }
    })
    .catch(error => {
      console.error('检查失败:', error.message)
    })
}