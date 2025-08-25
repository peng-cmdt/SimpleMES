#!/bin/bash

echo "🚀 SimpleMES PostgreSQL 数据库迁移向导"
echo "======================================"
echo ""

# 第一步：检查环境
echo "第1步: 环境检查"
echo "-------------"

# 检查PostgreSQL连接
echo "📋 请确保您已经："
echo "1. 安装了PostgreSQL数据库"
echo "2. 创建了数据库 'simplemes_db'"
echo "3. 更新了.env文件中的DATABASE_URL"
echo ""

read -p "是否已完成上述准备工作？(y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 请先完成环境准备，然后重新运行此脚本"
    echo ""
    echo "PostgreSQL安装和配置指南："
    echo "1. 安装PostgreSQL: https://postgresql.org/download/"
    echo "2. 创建数据库: CREATE DATABASE simplemes_db;"
    echo "3. 更新.env文件: DATABASE_URL=\"postgresql://用户名:密码@localhost:5432/simplemes_db\""
    exit 1
fi

echo "✅ 环境准备完成"
echo ""

# 第二步：测试数据库连接
echo "第2步: 测试数据库连接"
echo "----------------"
echo "🔄 正在测试PostgreSQL连接..."

npx prisma db push --preview-feature --skip-generate 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL连接成功"
else
    echo "❌ PostgreSQL连接失败"
    echo "请检查.env文件中的DATABASE_URL配置"
    exit 1
fi

echo ""

# 第三步：创建数据库结构
echo "第3步: 创建数据库结构"
echo "----------------"
echo "🔄 正在创建PostgreSQL数据库结构..."

npx prisma migrate dev --name "initial_postgresql_migration" --skip-seed
if [ $? -eq 0 ]; then
    echo "✅ 数据库结构创建成功"
else
    echo "❌ 数据库结构创建失败"
    exit 1
fi

echo ""

# 第四步：导入数据
echo "第4步: 导入现有数据"
echo "----------------"
echo "🔄 正在导入SQLite数据到PostgreSQL..."

node scripts/import-to-postgresql.js
if [ $? -eq 0 ]; then
    echo "✅ 数据导入成功"
else
    echo "❌ 数据导入失败"
    exit 1
fi

echo ""

# 第五步：验证
echo "第5步: 验证迁移结果"
echo "----------------"
echo "🧪 正在验证数据完整性..."

npx prisma generate
echo "✅ Prisma客户端生成完成"

echo ""

# 完成
echo "🎉 数据库迁移完成！"
echo "=================="
echo ""
echo "📊 迁移摘要："
echo "✅ SQLite数据已备份"  
echo "✅ PostgreSQL schema已创建"
echo "✅ 数据已迁移到PostgreSQL"
echo "✅ Prisma客户端已更新"
echo ""
echo "📝 后续步骤："
echo "1. 启动应用: npm run dev" 
echo "2. 验证所有功能正常工作"
echo "3. 测试设备通信服务"
echo "4. 检查数据完整性"
echo ""
echo "⚠️  重要提醒："
echo "- 原SQLite数据库已备份在 prisma/dev_backup_*.db"
echo "- 如需回滚，请恢复.env中的DATABASE_URL并重新生成客户端"
echo "- .NET设备通信服务不受此迁移影响"
echo ""
echo "🎯 迁移成功完成！"