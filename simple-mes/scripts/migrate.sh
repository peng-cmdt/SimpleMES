#!/bin/bash

# SimpleMES PostgreSQL迁移脚本
# 自动完成从SQLite到PostgreSQL的完整迁移过程

echo "🚀 SimpleMES PostgreSQL 数据库迁移"
echo "================================"

# 检查必要环境
echo "📋 检查环境依赖..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装Node.js"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ 请先安装npm"
    exit 1
fi

# 检查PostgreSQL服务（可选，用户可能使用远程数据库）
echo "✅ 环境检查完成"

# 进入项目目录
cd "$(dirname "$0")/.."

echo "📦 安装依赖..."
npm install

echo "🗄️  生成新的Prisma客户端..."
npx prisma generate

echo "🔄 重置PostgreSQL数据库结构（如果存在）..."
# 注意：这会删除现有数据，请确保数据库备份
npx prisma migrate reset --force --skip-seed

echo "📋 应用数据库架构..."
npx prisma migrate dev --name "initial_postgresql_migration"

echo "📊 执行数据迁移..."
npx ts-node scripts/migrate-to-postgresql.ts

echo "🌱 重新生成客户端..."
npx prisma generate

echo "🧪 运行种子数据（如果需要补充）..."
read -p "是否需要运行seed补充基础数据？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx prisma db seed
fi

echo "🎉 迁移完成！"
echo "请检查以下几点："
echo "1. PostgreSQL数据库连接是否正常"
echo "2. 业务功能是否工作正常" 
echo "3. 数据完整性验证"
echo "4. .NET设备通信服务重启测试"

echo "📝 后续操作提示："
echo "1. 启动前端: npm run dev"
echo "2. 启动.NET服务: cd ../DeviceCommunicationService/DeviceCommunicationService && dotnet run"
echo "3. 测试关键业务功能"