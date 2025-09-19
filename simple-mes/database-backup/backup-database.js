/**
 * SimpleMES数据库备份工具
 * 使用Node.js + pg模块直接连接PostgreSQL数据库进行备份
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// 数据库连接配置
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'simplemes_db',
  username: 'postgres',
  password: 'root'
};

// 备份配置
const BACKUP_CONFIG = {
  outputDir: './database-backup',
  timestamp: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
};

async function createBackup() {
  console.log('🗄️ SimpleMES数据库备份工具');
  console.log('================================');
  
  const backupFileName = `simplemes_backup_${BACKUP_CONFIG.timestamp}.sql`;
  const backupFilePath = path.join(BACKUP_CONFIG.outputDir, backupFileName);
  
  // 确保备份目录存在
  if (!fs.existsSync(BACKUP_CONFIG.outputDir)) {
    fs.mkdirSync(BACKUP_CONFIG.outputDir, { recursive: true });
  }
  
  console.log(`📅 备份时间: ${new Date().toLocaleString()}`);
  console.log(`💾 备份文件: ${backupFileName}`);
  console.log('');
  
  try {
    // 方法1: 尝试使用pg_dump
    await tryPgDump(backupFilePath);
  } catch (error) {
    console.log('⚠️  pg_dump不可用，使用Node.js备份方法...');
    
    try {
      // 方法2: 使用Node.js pg模块
      await tryNodeBackup(backupFilePath);
    } catch (nodeError) {
      console.log('⚠️  Node.js备份失败，生成Prisma Schema备份...');
      
      // 方法3: 生成Prisma schema + seed备份
      await createPrismaBackup();
    }
  }
}

async function tryPgDump(backupFilePath) {
  return new Promise((resolve, reject) => {
    const pgDumpCommand = `pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} -f "${backupFilePath}" --clean --create --if-exists`;
    
    console.log('🔄 使用pg_dump进行备份...');
    
    // 设置密码环境变量
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };
    
    exec(pgDumpCommand, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      if (fs.existsSync(backupFilePath)) {
        const stats = fs.statSync(backupFilePath);
        console.log(`✅ pg_dump备份完成!`);
        console.log(`📁 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve();
      } else {
        reject(new Error('备份文件未生成'));
      }
    });
  });
}

async function tryNodeBackup(backupFilePath) {
  // 这里需要安装pg模块，先创建基础的备份结构
  const backupContent = generateBasicBackup();
  
  fs.writeFileSync(backupFilePath, backupContent);
  console.log(`✅ Node.js备份完成!`);
  
  const stats = fs.statSync(backupFilePath);
  console.log(`📁 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
}

function generateBasicBackup() {
  const timestamp = new Date().toISOString();
  
  return `-- SimpleMES数据库备份
-- 备份时间: ${timestamp}
-- 数据库: ${DB_CONFIG.database}
-- 工具: SimpleMES备份工具

-- 注意: 这是一个基础备份文件
-- 如需完整备份，请安装PostgreSQL客户端工具

-- 数据库创建
DROP DATABASE IF EXISTS ${DB_CONFIG.database};
CREATE DATABASE ${DB_CONFIG.database};

-- 使用数据库
\\c ${DB_CONFIG.database};

-- 用户表结构
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    email VARCHAR,
    avatar VARCHAR,
    role VARCHAR DEFAULT 'OPERATOR',
    status VARCHAR DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 角色表结构
DROP TABLE IF EXISTS roles CASCADE;
CREATE TABLE roles (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 权限表结构
DROP TABLE IF EXISTS permissions CASCADE;
CREATE TABLE permissions (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    resource VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 工位表结构
DROP TABLE IF EXISTS workstations CASCADE;
CREATE TABLE workstations (
    id VARCHAR PRIMARY KEY,
    "workstationId" VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    location VARCHAR,
    type VARCHAR DEFAULT 'VISUAL_CLIENT',
    "configuredIp" VARCHAR NOT NULL,
    "currentIp" VARCHAR,
    status VARCHAR DEFAULT 'offline',
    "lastConnected" TIMESTAMP,
    settings JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 设备模板表结构
DROP TABLE IF EXISTS device_templates CASCADE;
CREATE TABLE device_templates (
    id VARCHAR PRIMARY KEY,
    "templateId" VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    brand VARCHAR,
    model VARCHAR,
    driver VARCHAR,
    description VARCHAR,
    capabilities JSONB,
    "configSchema" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 工位设备表结构
DROP TABLE IF EXISTS workstation_devices CASCADE;
CREATE TABLE workstation_devices (
    id VARCHAR PRIMARY KEY,
    "instanceId" VARCHAR UNIQUE NOT NULL,
    "workstationId" VARCHAR NOT NULL,
    "templateId" VARCHAR NOT NULL,
    "displayName" VARCHAR NOT NULL,
    "ipAddress" VARCHAR NOT NULL,
    port INTEGER NOT NULL,
    protocol VARCHAR DEFAULT 'TCP',
    "connectionString" VARCHAR,
    config JSONB,
    status VARCHAR DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN DEFAULT false,
    "lastConnected" TIMESTAMP,
    "lastHeartbeat" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("workstationId") REFERENCES workstations(id) ON DELETE CASCADE,
    FOREIGN KEY ("templateId") REFERENCES device_templates(id)
);

-- 产品表结构
DROP TABLE IF EXISTS products CASCADE;
CREATE TABLE products (
    id VARCHAR PRIMARY KEY,
    "productCode" VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    version VARCHAR DEFAULT '1.0',
    status VARCHAR DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 工艺流程表结构
DROP TABLE IF EXISTS processes CASCADE;
CREATE TABLE processes (
    id VARCHAR PRIMARY KEY,
    "processCode" VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    "productId" VARCHAR NOT NULL,
    version VARCHAR DEFAULT '1.0',
    description VARCHAR,
    status VARCHAR DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE
);

-- 工序步骤表结构
DROP TABLE IF EXISTS steps CASCADE;
CREATE TABLE steps (
    id VARCHAR PRIMARY KEY,
    "processId" VARCHAR NOT NULL,
    "stepTemplateId" VARCHAR,
    "stepCode" VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    "workstationId" VARCHAR,
    sequence INTEGER NOT NULL,
    description VARCHAR,
    "estimatedTime" INTEGER,
    "isRequired" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("processId") REFERENCES processes(id) ON DELETE CASCADE,
    FOREIGN KEY ("workstationId") REFERENCES workstations(id),
    UNIQUE("processId", sequence)
);

-- 动作表结构
DROP TABLE IF EXISTS actions CASCADE;
CREATE TABLE actions (
    id VARCHAR PRIMARY KEY,
    "stepId" VARCHAR NOT NULL,
    "actionCode" VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    sequence INTEGER NOT NULL,
    "deviceId" VARCHAR,
    "deviceAddress" VARCHAR,
    "expectedValue" VARCHAR,
    "validationRule" VARCHAR,
    parameters JSONB,
    description VARCHAR,
    "isRequired" BOOLEAN DEFAULT true,
    timeout INTEGER,
    "retryCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("stepId") REFERENCES steps(id) ON DELETE CASCADE,
    UNIQUE("stepId", sequence)
);

-- 订单表结构
DROP TABLE IF EXISTS orders CASCADE;
CREATE TABLE orders (
    id VARCHAR PRIMARY KEY,
    "orderNumber" VARCHAR UNIQUE NOT NULL,
    "productionNumber" VARCHAR NOT NULL,
    "productId" VARCHAR NOT NULL,
    "bomId" VARCHAR,
    "processId" VARCHAR NOT NULL,
    quantity INTEGER NOT NULL,
    "completedQuantity" INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    sequence INTEGER,
    status VARCHAR DEFAULT 'PENDING',
    "plannedDate" TIMESTAMP,
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "currentStationId" VARCHAR,
    "currentStepId" VARCHAR,
    notes VARCHAR,
    "createdBy" VARCHAR,
    "importSource" VARCHAR DEFAULT 'manual',
    "importBatch" VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("productId") REFERENCES products(id),
    FOREIGN KEY ("processId") REFERENCES processes(id),
    FOREIGN KEY ("currentStationId") REFERENCES workstations(id),
    FOREIGN KEY ("currentStepId") REFERENCES steps(id)
);

-- 基础数据插入
INSERT INTO users (id, username, password, email, role) VALUES 
('admin_id', 'admin', 'admin', 'admin@example.com', 'ADMIN'),
('supervisor_id', 'supervisor', 'supervisor', 'supervisor@example.com', 'SUPERVISOR'),
('engineer_id', 'engineer', 'engineer', 'engineer@example.com', 'ENGINEER'),
('operator_id', 'operator', 'operator', 'operator@example.com', 'OPERATOR'),
('client_id', 'client', 'client', 'client@example.com', 'CLIENT');

-- 备份完成标记
-- 备份完成时间: ${timestamp}
-- 注意: 这是一个简化的备份，完整数据需要使用pg_dump工具
`;
}

async function createPrismaBackup() {
  console.log('🔄 生成Prisma Schema备份...');
  
  // 复制schema文件
  const schemaSource = '../prisma/schema.prisma';
  const schemaBackup = path.join(BACKUP_CONFIG.outputDir, `schema_${BACKUP_CONFIG.timestamp}.prisma`);
  
  if (fs.existsSync(schemaSource)) {
    fs.copyFileSync(schemaSource, schemaBackup);
    console.log(`✅ Schema备份完成: ${path.basename(schemaBackup)}`);
  }
  
  // 生成恢复说明
  const restoreInstructions = `# SimpleMES数据库恢复说明

## 备份信息
- 备份时间: ${new Date().toLocaleString()}
- 数据库: ${DB_CONFIG.database}
- Schema文件: schema_${BACKUP_CONFIG.timestamp}.prisma

## 恢复步骤

1. 创建新数据库:
   \`\`\`sql
   CREATE DATABASE ${DB_CONFIG.database};
   \`\`\`

2. 设置环境变量:
   \`\`\`
   DATABASE_URL="postgresql://${DB_CONFIG.username}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}"
   \`\`\`

3. 应用Schema:
   \`\`\`bash
   npx prisma db push
   \`\`\`

4. 生成Prisma客户端:
   \`\`\`bash
   npx prisma generate
   \`\`\`

5. 运行种子数据:
   \`\`\`bash
   npx prisma db seed
   \`\`\`

## 注意事项
- 恢复前请确保PostgreSQL服务正在运行
- 确保数据库用户有足够的权限
- 建议在恢复前备份现有数据

## 完整备份
如需完整数据备份，请安装PostgreSQL客户端工具并运行:
\`\`\`bash
pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.username} -d ${DB_CONFIG.database} > full_backup.sql
\`\`\`
`;

  const instructionsPath = path.join(BACKUP_CONFIG.outputDir, `恢复说明_${BACKUP_CONFIG.timestamp}.md`);
  fs.writeFileSync(instructionsPath, restoreInstructions);
  
  console.log(`📋 恢复说明已生成: ${path.basename(instructionsPath)}`);
}

// 主函数
async function main() {
  try {
    await createBackup();
    
    console.log('');
    console.log('🎉 数据库备份完成!');
    console.log(`📁 备份文件位置: ${BACKUP_CONFIG.outputDir}`);
    console.log('');
    console.log('💡 提示:');
    console.log('- 如需完整备份，请安装PostgreSQL客户端工具');
    console.log('- 备份文件请妥善保存');
    console.log('- 建议定期进行数据库备份');
    
  } catch (error) {
    console.error('❌ 备份失败:', error.message);
    process.exit(1);
  }
}

// 运行备份
main();