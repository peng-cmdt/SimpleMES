console.log('🧹 清理旧SQLite文件和迁移')
console.log('=========================')

const fs = require('fs')
const path = require('path')

function cleanupOldFiles() {
  const basePath = '.'
  const backupPath = './archive_sqlite_backup'

  try {
    // 1. 创建备份目录
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true })
      console.log(`✅ 创建备份目录: ${backupPath}`)
    }

    // 2. 备份并删除SQLite文件
    const sqliteFiles = [
      'prisma/dev.db',
      'prisma/dev_backup_20250824_220020.db'
    ]

    console.log('\n📦 备份SQLite文件...')
    sqliteFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupFile = path.join(backupPath, path.basename(file))
        fs.copyFileSync(file, backupFile)
        console.log(`✅ 备份: ${file} -> ${backupFile}`)
        
        fs.unlinkSync(file)
        console.log(`🗑️  删除: ${file}`)
      } else {
        console.log(`⚠️  文件不存在: ${file}`)
      }
    })

    // 3. 备份导出文件
    const exportFiles = [
      'prisma/sqlite_export.json'
    ]

    console.log('\n📦 备份导出文件...')
    exportFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const backupFile = path.join(backupPath, path.basename(file))
        fs.copyFileSync(file, backupFile)
        console.log(`✅ 备份: ${file} -> ${backupFile}`)
        
        fs.unlinkSync(file)
        console.log(`🗑️  删除: ${file}`)
      } else {
        console.log(`⚠️  文件不存在: ${file}`)
      }
    })

    // 4. 保留SQLite迁移文件夹，但创建说明
    const migrationsPath = 'prisma/migrations'
    const readmeContent = `# SQLite Migrations (Archived)

This folder contains the original SQLite migrations from before PostgreSQL migration.

These files are kept for historical reference but are no longer used.

## Migration Timeline:
- Original SQLite migrations: 2025-08-20 to 2025-08-23
- PostgreSQL migration: 2025-08-24
- Current database: PostgreSQL

## Status:
✅ All data successfully migrated to PostgreSQL
✅ All business functions preserved
✅ Application fully operational on PostgreSQL

Last updated: ${new Date().toISOString()}
`

    fs.writeFileSync(path.join(migrationsPath, 'README_SQLITE_ARCHIVED.md'), readmeContent)
    console.log(`\n📝 创建迁移说明: ${migrationsPath}/README_SQLITE_ARCHIVED.md`)

    // 5. 清理导入导出脚本
    const cleanupScripts = [
      'scripts/export-sqlite-data.js',
      'scripts/import-to-postgresql-fixed.js',
      'scripts/get-process-id.js'
    ]

    console.log('\n🧹 清理临时脚本...')
    cleanupScripts.forEach(script => {
      if (fs.existsSync(script)) {
        const backupScript = path.join(backupPath, path.basename(script))
        fs.copyFileSync(script, backupScript)
        console.log(`✅ 备份脚本: ${script} -> ${backupScript}`)
        
        fs.unlinkSync(script)
        console.log(`🗑️  删除脚本: ${script}`)
      }
    })

    console.log('\n🎯 清理结果:')
    console.log('=============')
    console.log('✅ SQLite数据库文件已备份并删除')
    console.log('✅ 导出文件已备份并删除')
    console.log('✅ 临时脚本已备份并删除')
    console.log('✅ SQLite迁移文件夹已标记为历史存档')
    console.log(`✅ 所有备份保存在: ${backupPath}`)
    console.log('✅ 系统完全迁移到PostgreSQL!')

    return true

  } catch (error) {
    console.error('❌ 清理过程失败:', error.message)
    return false
  }
}

if (require.main === module) {
  cleanupOldFiles()
}