-- SimpleMES数据库备份
-- 备份时间: 2025-09-15T03:53:15.108Z
-- 数据库: simplemes_db
-- 工具: SimpleMES备份工具

-- 注意: 这是一个基础备份文件
-- 如需完整备份，请安装PostgreSQL客户端工具

-- 数据库创建
DROP DATABASE IF EXISTS simplemes_db;
CREATE DATABASE simplemes_db;

-- 使用数据库
\c simplemes_db;

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
-- 备份完成时间: 2025-09-15T03:53:15.108Z
-- 注意: 这是一个简化的备份，完整数据需要使用pg_dump工具
