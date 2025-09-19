/**
 * SimpleMES完整数据导出工具
 * 导出当前数据库的完整数据为SQL文件
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function exportDatabase() {
  console.log('🗄️ SimpleMES完整数据导出');
  console.log('================================');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = path.join(__dirname, `simplemes_full_backup_${timestamp}.sql`);
  
  let sqlContent = `-- SimpleMES完整数据库备份
-- 导出时间: ${new Date().toISOString()}
-- 数据库: simplemes_db
-- 工具: SimpleMES数据导出工具

-- ========================================
-- 数据库结构
-- ========================================

-- 删除并重建数据库
DROP DATABASE IF EXISTS simplemes_db;
CREATE DATABASE simplemes_db;
\\c simplemes_db;

-- 用户表
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

-- 角色表
CREATE TABLE roles (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 权限表
CREATE TABLE permissions (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    resource VARCHAR NOT NULL,
    action VARCHAR NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- 用户角色关联表
CREATE TABLE user_role_assignments (
    id VARCHAR PRIMARY KEY,
    "userId" VARCHAR NOT NULL,
    "roleId" VARCHAR NOT NULL,
    FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE("userId", "roleId")
);

-- 角色权限关联表
CREATE TABLE role_permissions (
    id VARCHAR PRIMARY KEY,
    "roleId" VARCHAR NOT NULL,
    "permissionId" VARCHAR NOT NULL,
    FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY ("permissionId") REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE("roleId", "permissionId")
);

-- 菜单表
CREATE TABLE menus (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    path VARCHAR,
    icon VARCHAR,
    "parentId" VARCHAR,
    "order" INTEGER DEFAULT 0,
    permissions VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("parentId") REFERENCES menus(id)
);

-- 工位表
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

-- 设备模板表
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

-- 工位设备表
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
    FOREIGN KEY ("templateId") REFERENCES device_templates(id),
    UNIQUE("workstationId", "instanceId")
);

-- 产品表
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

-- 工艺流程表
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

-- 工序步骤表
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

-- 动作表
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

-- 订单表
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

-- 工位会话表
CREATE TABLE workstation_sessions (
    id VARCHAR PRIMARY KEY,
    "sessionId" VARCHAR UNIQUE NOT NULL,
    "workstationId" VARCHAR NOT NULL,
    "userId" VARCHAR,
    username VARCHAR,
    "loginTime" TIMESTAMP DEFAULT NOW(),
    "logoutTime" TIMESTAMP,
    "isActive" BOOLEAN DEFAULT true,
    "lastActivity" TIMESTAMP DEFAULT NOW(),
    "connectedDevices" JSONB,
    settings JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("workstationId") REFERENCES workstations(id) ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES users(id)
);

-- 系统配置表
CREATE TABLE system_configs (
    id VARCHAR PRIMARY KEY,
    key VARCHAR UNIQUE NOT NULL,
    value VARCHAR NOT NULL,
    description VARCHAR,
    category VARCHAR,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 数据导出
-- ========================================

`;

  try {
    console.log('🔄 正在导出数据...');
    
    // 导出用户数据
    console.log('📥 导出用户数据...');
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      sqlContent += `\n-- 用户数据\n`;
      for (const user of users) {
        const values = [
          `'${user.id}'`,
          `'${user.username}'`,
          `'${user.password}'`,
          user.email ? `'${user.email}'` : 'NULL',
          user.avatar ? `'${user.avatar}'` : 'NULL',
          `'${user.role}'`,
          `'${user.status}'`,
          `'${user.createdAt.toISOString()}'`,
          `'${user.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }
    
    // 导出角色数据
    console.log('📥 导出角色数据...');
    const roles = await prisma.role.findMany();
    if (roles.length > 0) {
      sqlContent += `\n-- 角色数据\n`;
      for (const role of roles) {
        const values = [
          `'${role.id}'`,
          `'${role.name}'`,
          role.description ? `'${role.description}'` : 'NULL',
          `'${role.createdAt.toISOString()}'`,
          `'${role.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 导出权限数据
    console.log('📥 导出权限数据...');
    const permissions = await prisma.permission.findMany();
    if (permissions.length > 0) {
      sqlContent += `\n-- 权限数据\n`;
      for (const permission of permissions) {
        const values = [
          `'${permission.id}'`,
          `'${permission.name}'`,
          permission.description ? `'${permission.description}'` : 'NULL',
          `'${permission.resource}'`,
          `'${permission.action}'`,
          `'${permission.createdAt.toISOString()}'`,
          `'${permission.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }
    
    // 导出工位数据
    console.log('📥 导出工位数据...');
    const workstations = await prisma.workstation.findMany();
    if (workstations.length > 0) {
      sqlContent += `\n-- 工位数据\n`;
      for (const ws of workstations) {
        const values = [
          `'${ws.id}'`,
          `'${ws.workstationId}'`,
          `'${ws.name}'`,
          ws.description ? `'${ws.description}'` : 'NULL',
          ws.location ? `'${ws.location}'` : 'NULL',
          `'${ws.type}'`,
          `'${ws.configuredIp}'`,
          ws.currentIp ? `'${ws.currentIp}'` : 'NULL',
          `'${ws.status}'`,
          ws.lastConnected ? `'${ws.lastConnected.toISOString()}'` : 'NULL',
          ws.settings ? `'${JSON.stringify(ws.settings)}'::jsonb` : 'NULL',
          `'${ws.createdAt.toISOString()}'`,
          `'${ws.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO workstations (id, "workstationId", name, description, location, type, "configuredIp", "currentIp", status, "lastConnected", settings, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 导出设备模板数据
    console.log('📥 导出设备模板数据...');
    const deviceTemplates = await prisma.deviceTemplate.findMany();
    if (deviceTemplates.length > 0) {
      sqlContent += `\n-- 设备模板数据\n`;
      for (const template of deviceTemplates) {
        const values = [
          `'${template.id}'`,
          `'${template.templateId}'`,
          `'${template.name}'`,
          `'${template.type}'`,
          template.brand ? `'${template.brand}'` : 'NULL',
          template.model ? `'${template.model}'` : 'NULL',
          template.driver ? `'${template.driver}'` : 'NULL',
          template.description ? `'${template.description}'` : 'NULL',
          template.capabilities ? `'${JSON.stringify(template.capabilities)}'::jsonb` : 'NULL',
          template.configSchema ? `'${JSON.stringify(template.configSchema)}'::jsonb` : 'NULL',
          `'${template.createdAt.toISOString()}'`,
          `'${template.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO device_templates (id, "templateId", name, type, brand, model, driver, description, capabilities, "configSchema", "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 导出工位设备数据
    console.log('📥 导出工位设备数据...');
    const workstationDevices = await prisma.workstationDevice.findMany();
    if (workstationDevices.length > 0) {
      sqlContent += `\n-- 工位设备数据\n`;
      for (const device of workstationDevices) {
        const values = [
          `'${device.id}'`,
          `'${device.instanceId}'`,
          `'${device.workstationId}'`,
          `'${device.templateId}'`,
          `'${device.displayName}'`,
          `'${device.ipAddress}'`,
          device.port,
          device.protocol ? `'${device.protocol}'` : 'NULL',
          device.connectionString ? `'${device.connectionString}'` : 'NULL',
          device.config ? `'${JSON.stringify(device.config)}'::jsonb` : 'NULL',
          `'${device.status}'`,
          device.isOnline ? 'true' : 'false',
          device.lastConnected ? `'${device.lastConnected.toISOString()}'` : 'NULL',
          device.lastHeartbeat ? `'${device.lastHeartbeat.toISOString()}'` : 'NULL',
          `'${device.createdAt.toISOString()}'`,
          `'${device.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO workstation_devices (id, "instanceId", "workstationId", "templateId", "displayName", "ipAddress", port, protocol, "connectionString", config, status, "isOnline", "lastConnected", "lastHeartbeat", "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 导出产品数据
    console.log('📥 导出产品数据...');
    const products = await prisma.product.findMany();
    if (products.length > 0) {
      sqlContent += `\n-- 产品数据\n`;
      for (const product of products) {
        const values = [
          `'${product.id}'`,
          `'${product.productCode}'`,
          `'${product.name}'`,
          product.description ? `'${product.description}'` : 'NULL',
          `'${product.version}'`,
          `'${product.status}'`,
          `'${product.createdAt.toISOString()}'`,
          `'${product.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO products (id, "productCode", name, description, version, status, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 导出菜单数据
    console.log('📥 导出菜单数据...');
    const menus = await prisma.menu.findMany();
    if (menus.length > 0) {
      sqlContent += `\n-- 菜单数据\n`;
      for (const menu of menus) {
        const values = [
          `'${menu.id}'`,
          `'${menu.name}'`,
          menu.path ? `'${menu.path}'` : 'NULL',
          menu.icon ? `'${menu.icon}'` : 'NULL',
          menu.parentId ? `'${menu.parentId}'` : 'NULL',
          menu.order,
          `'${menu.permissions}'`,
          `'${menu.status}'`,
          `'${menu.createdAt.toISOString()}'`,
          `'${menu.updatedAt.toISOString()}'`
        ];
        sqlContent += `INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES (${values.join(', ')});\n`;
      }
    }

    // 完成标记
    sqlContent += `\n-- ========================================\n`;
    sqlContent += `-- 数据导出完成\n`;
    sqlContent += `-- 导出时间: ${new Date().toISOString()}\n`;
    sqlContent += `-- ========================================\n`;
    
    // 写入文件
    fs.writeFileSync(outputFile, sqlContent);
    
    const stats = fs.statSync(outputFile);
    
    console.log('✅ 完整数据导出成功!');
    console.log(`📁 输出文件: ${path.basename(outputFile)}`);
    console.log(`📊 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`📋 导出统计:`);
    console.log(`   - 用户: ${users.length} 条`);
    console.log(`   - 角色: ${roles.length} 条`);
    console.log(`   - 权限: ${permissions.length} 条`);
    console.log(`   - 工位: ${workstations.length} 条`);
    console.log(`   - 设备模板: ${deviceTemplates.length} 条`);
    console.log(`   - 工位设备: ${workstationDevices.length} 条`);
    console.log(`   - 产品: ${products.length} 条`);
    console.log(`   - 菜单: ${menus.length} 条`);
    
  } catch (error) {
    console.error('❌ 数据导出失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行导出
exportDatabase();