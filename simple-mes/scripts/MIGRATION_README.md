# SimpleMES PostgreSQL 数据库迁移指南

本指南将帮助您将SimpleMES系统从SQLite迁移到PostgreSQL数据库，确保所有业务功能完整保留。

## 📋 迁移前准备

### 1. PostgreSQL 安装
- **Windows**: 从 [postgresql.org](https://www.postgresql.org/download/windows/) 下载并安装
- **Linux/macOS**: 使用包管理器安装（如 `apt install postgresql` 或 `brew install postgresql`）

### 2. 创建目标数据库
连接到PostgreSQL并创建数据库：
```sql
CREATE DATABASE simplemes_db;
CREATE USER simplemes_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE simplemes_db TO simplemes_user;
```

### 3. 更新环境配置
修改 `.env` 文件中的数据库连接字符串：
```env
DATABASE_URL="postgresql://simplemes_user:your_password@localhost:5432/simplemes_db?schema=public"
```

## 🚀 执行迁移

### 方式一：使用自动化迁移向导（推荐）

**Windows**:
```bash
cd simple-mes
scripts\migration-wizard.bat
```

**Linux/macOS**:
```bash
cd simple-mes
chmod +x scripts/migration-wizard.sh
./scripts/migration-wizard.sh
```

### 方式二：手动执行步骤

1. **备份当前数据**（已完成）
   ```bash
   # SQLite数据库已自动备份到 prisma/dev_backup_*.db
   ```

2. **导出SQLite数据**（已完成）
   ```bash
   node scripts/export-sqlite-data.js
   ```

3. **创建PostgreSQL Schema**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name "initial_postgresql_migration" --skip-seed
   ```

4. **导入数据到PostgreSQL**
   ```bash
   node scripts/import-to-postgresql.js
   ```

5. **验证和完成**
   ```bash
   npx prisma generate
   npm run dev
   ```

## 📊 迁移内容

### 数据表（26个）
- ✅ **用户权限系统**: users, roles, permissions, user_role_assignments, role_permissions
- ✅ **设备管理**: devices, clients, workstations, workstation_sessions  
- ✅ **产品工艺**: products, processes, steps, actions, step_templates, action_templates
- ✅ **生产管理**: orders, order_steps, order_status_history, action_logs
- ✅ **物料管理**: boms, bom_items, parts, product_workstations
- ✅ **系统配置**: menus, step_conditions, data_export_records

### 迁移的数据量
```
总表数: 26
有数据表: 22  
总记录数: 373+
```

### 关键业务数据
- **用户账户**: 5个用户（admin, supervisor, engineer, operator, client）
- **权限系统**: 32个权限，85个权限分配
- **工位设备**: 2个工位，10个设备配置
- **产品工艺**: 2个产品，2个工艺流程
- **生产订单**: 4个生产订单及历史记录
- **BOM物料**: 4个BOM，30个物料项，129个零件

## 🔍 迁移后验证

### 1. 系统功能测试
- [ ] 用户登录功能（所有角色）
- [ ] 工位管理和设备连接
- [ ] 产品和工艺流程管理  
- [ ] 生产订单创建和执行
- [ ] BOM和物料管理
- [ ] 权限控制功能

### 2. 数据完整性检查
```bash
# 连接数据库检查记录数
psql -d simplemes_db -c "SELECT 
    schemaname,
    tablename,
    n_tup_ins as rows
FROM pg_stat_user_tables 
ORDER BY n_tup_ins DESC;"
```

### 3. 设备通信服务
- [ ] .NET服务正常启动（端口5000）
- [ ] WebSocket连接正常
- [ ] 设备状态同步正常
- [ ] PLC/扫码枪通信正常

## 🔄 回滚方案

如果需要回滚到SQLite：

1. **恢复环境配置**
   ```env
   DATABASE_URL="file:./dev.db"
   ```

2. **更新Prisma schema**
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

3. **重新生成客户端**
   ```bash
   npx prisma generate
   ```

## ⚠️ 注意事项

### 数据库差异处理
- **枚举类型**: PostgreSQL使用真正的ENUM，SQLite使用TEXT
- **日期时间**: PostgreSQL的TIMESTAMP vs SQLite的TEXT  
- **JSON字段**: PostgreSQL原生支持，SQLite使用TEXT存储
- **外键约束**: PostgreSQL严格执行，SQLite默认关闭

### 性能优化
- 已包含必要的数据库索引
- 复合索引支持复杂查询
- 外键关系优化数据完整性

### 生产环境建议
- 使用连接池（如pgpool, pgbouncer）
- 配置合适的PostgreSQL参数
- 设置定期备份策略
- 监控数据库性能

## 📞 技术支持

如果迁移过程中遇到问题：

1. **检查日志**: 查看Prisma和数据库错误日志
2. **验证连接**: 确认DATABASE_URL配置正确
3. **权限检查**: 确认数据库用户权限充足
4. **端口冲突**: 确认PostgreSQL端口（默认5432）可用

## 🎯 迁移完成标志

- ✅ 前端应用正常启动（`npm run dev`）
- ✅ 用户可以正常登录所有角色
- ✅ 设备通信服务连接正常
- ✅ 生产订单流程完整可用
- ✅ 所有数据查询和更新正常
- ✅ 无Prisma连接错误

## 📈 迁移优势

- **更好的并发性能**: PostgreSQL支持更高的并发连接
- **完整的事务支持**: ACID特性保证数据一致性
- **丰富的数据类型**: 原生JSON、数组等高级类型
- **企业级特性**: 复制、分区、全文搜索等
- **更好的扩展性**: 支持水平和垂直扩展

迁移完成后，SimpleMES将拥有更强大的数据库基础，支持更大规模的制造执行场景。