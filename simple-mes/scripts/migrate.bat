@echo off
REM SimpleMES PostgreSQL迁移脚本 - Windows版本
REM 自动完成从SQLite到PostgreSQL的完整迁移过程

echo 🚀 SimpleMES PostgreSQL 数据库迁移
echo ================================

REM 检查必要环境
echo 📋 检查环境依赖...

REM 检查Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 请先安装Node.js
    exit /b 1
)

REM 检查npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 请先安装npm
    exit /b 1
)

echo ✅ 环境检查完成

REM 进入项目目录
cd /d "%~dp0.."

echo 📦 安装依赖...
call npm install

echo 🗄️  生成新的Prisma客户端...
call npx prisma generate

echo 🔄 重置PostgreSQL数据库结构（如果存在）...
REM 注意：这会删除现有数据，请确保数据库备份
call npx prisma migrate reset --force --skip-seed

echo 📋 应用数据库架构...
call npx prisma migrate dev --name "initial_postgresql_migration"

echo 📊 执行数据迁移...
call npx ts-node scripts/migrate-to-postgresql.ts

echo 🌱 重新生成客户端...
call npx prisma generate

echo 🧪 运行种子数据（如果需要补充）...
set /p choice="是否需要运行seed补充基础数据？(y/n): "
if /i "%choice%"=="y" (
    call npx prisma db seed
)

echo 🎉 迁移完成！
echo 请检查以下几点：
echo 1. PostgreSQL数据库连接是否正常
echo 2. 业务功能是否工作正常
echo 3. 数据完整性验证
echo 4. .NET设备通信服务重启测试

echo 📝 后续操作提示：
echo 1. 启动前端: npm run dev
echo 2. 启动.NET服务: cd ../DeviceCommunicationService/DeviceCommunicationService ^&^& dotnet run
echo 3. 测试关键业务功能

pause