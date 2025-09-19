-- SimpleMES完整数据库备份
-- 导出时间: 2025-09-15T03:54:35.850Z
-- 数据库: simplemes_db
-- 工具: SimpleMES数据导出工具

-- ========================================
-- 数据库结构
-- ========================================

-- 删除并重建数据库
DROP DATABASE IF EXISTS simplemes_db;
CREATE DATABASE simplemes_db;
\c simplemes_db;

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


-- 用户数据
INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES ('cmfes0vxi0089tmqwtxsvaqju', 'admin', '$2b$10$w3h4WcB1De7VbbDFVa39D.KJdpE0DJ25AbG3w0OIzmuGyIpmGGz6W', 'admin@example.com', NULL, 'ADMIN', 'active', '2025-09-11T02:15:42.247Z', '2025-09-12T06:00:53.466Z');
INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES ('cmfes0vxr008atmqw0b232u03', 'supervisor', '$2b$10$CNu8nwo2UM/seBKUpmdvwuNlIGjJDf.1DVSSMyxyPJ4ljfYsR0.Ya', 'supervisor@example.com', NULL, 'SUPERVISOR', 'active', '2025-09-11T02:15:42.255Z', '2025-09-12T06:00:53.474Z');
INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES ('cmfes0vxs008btmqw0ds5i9ay', 'engineer', '$2b$10$chOz5KVAHjhvDhQKye8Ba.IylxeSF8XbAE.JKRXuzZS3DXAHPOzRu', 'engineer@example.com', NULL, 'ENGINEER', 'active', '2025-09-11T02:15:42.256Z', '2025-09-12T06:00:53.475Z');
INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES ('cmfes0vxu008ctmqwu3jk55c6', 'operator', '$2b$10$ksNLwa5v3AfnyI1cQaNl.O4q5gLF1UbhduJ9uUNSfka2IgjytAMlS', 'operator@example.com', NULL, 'OPERATOR', 'active', '2025-09-11T02:15:42.258Z', '2025-09-12T06:00:53.476Z');
INSERT INTO users (id, username, password, email, avatar, role, status, "createdAt", "updatedAt") VALUES ('cmfes0vxw008dtmqwm8ulsb7x', 'client', '$2b$10$fhuPSzjdzy3eUS6fIFhyGOVhZwawyMIU1Zxzx4v5u0ExNaI2QKD8W', 'client@example.com', NULL, 'CLIENT', 'active', '2025-09-11T02:15:42.260Z', '2025-09-12T06:00:53.478Z');

-- 角色数据
INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES ('cmfes0vdk001ctmqw3i89tcej', 'ADMIN', '系统管理员 - 拥有所有权限', '2025-09-11T02:15:41.528Z', '2025-09-12T06:00:52.679Z');
INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES ('cmfes0vdm001dtmqwxe5ojqyk', 'SUPERVISOR', '主管 - 生产管理和用户管理权限', '2025-09-11T02:15:41.531Z', '2025-09-12T06:00:52.681Z');
INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES ('cmfes0vdo001etmqwalwlnb3j', 'ENGINEER', '工程师 - 技术配置和工艺管理权限', '2025-09-11T02:15:41.532Z', '2025-09-12T06:00:52.682Z');
INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES ('cmfes0vdp001ftmqwfvmj0a00', 'OPERATOR', '操作员 - 生产执行权限', '2025-09-11T02:15:41.533Z', '2025-09-12T06:00:52.683Z');
INSERT INTO roles (id, name, description, "createdAt", "updatedAt") VALUES ('cmfes0vdq001gtmqw0pqfj32o', 'CLIENT', '客户端 - 工位操作权限', '2025-09-11T02:15:41.534Z', '2025-09-12T06:00:52.684Z');

-- 权限数据
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vbr0000tmqwpllkvyt7', 'users:read', '查看用户', 'users', 'read', '2025-09-11T02:15:41.463Z', '2025-09-12T06:00:52.609Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vbx0001tmqwi5vxze7l', 'users:create', '创建用户', 'users', 'create', '2025-09-11T02:15:41.470Z', '2025-09-12T06:00:52.615Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vbz0002tmqwlphz7jvf', 'users:update', '更新用户', 'users', 'update', '2025-09-11T02:15:41.471Z', '2025-09-12T06:00:52.617Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc10003tmqwevwyy2vo', 'users:delete', '删除用户', 'users', 'delete', '2025-09-11T02:15:41.473Z', '2025-09-12T06:00:52.618Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc20004tmqwy2q0xu9w', 'roles:read', '查看角色', 'roles', 'read', '2025-09-11T02:15:41.475Z', '2025-09-12T06:00:52.620Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc40005tmqwt2v2kjn2', 'roles:create', '创建角色', 'roles', 'create', '2025-09-11T02:15:41.477Z', '2025-09-12T06:00:52.621Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc60006tmqwzk3z9qhf', 'roles:update', '更新角色', 'roles', 'update', '2025-09-11T02:15:41.478Z', '2025-09-12T06:00:52.623Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc70007tmqws9ocf6by', 'roles:delete', '删除角色', 'roles', 'delete', '2025-09-11T02:15:41.480Z', '2025-09-12T06:00:52.624Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vc90008tmqwemepogyt', 'permissions:read', '查看权限', 'permissions', 'read', '2025-09-11T02:15:41.481Z', '2025-09-12T06:00:52.626Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vca0009tmqwaxfc4xir', 'permissions:manage', '管理权限', 'permissions', 'manage', '2025-09-11T02:15:41.483Z', '2025-09-12T06:00:52.628Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcc000atmqwssocju3o', 'menus:read', '查看菜单', 'menus', 'read', '2025-09-11T02:15:41.484Z', '2025-09-12T06:00:52.629Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcd000btmqwwk2xgydv', 'menus:create', '创建菜单', 'menus', 'create', '2025-09-11T02:15:41.485Z', '2025-09-12T06:00:52.630Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vce000ctmqwhx9q2v6j', 'menus:update', '更新菜单', 'menus', 'update', '2025-09-11T02:15:41.486Z', '2025-09-12T06:00:52.632Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcf000dtmqweopdezs5', 'menus:delete', '删除菜单', 'menus', 'delete', '2025-09-11T02:15:41.488Z', '2025-09-12T06:00:52.633Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcg000etmqw8r5fmw6b', 'products:read', '查看产品', 'products', 'read', '2025-09-11T02:15:41.489Z', '2025-09-12T06:00:52.634Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vch000ftmqwoy4yvte3', 'products:create', '创建产品', 'products', 'create', '2025-09-11T02:15:41.490Z', '2025-09-12T06:00:52.636Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcj000gtmqwtzzdgle8', 'products:update', '更新产品', 'products', 'update', '2025-09-11T02:15:41.491Z', '2025-09-12T06:00:52.637Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vck000htmqw68q1n78m', 'products:delete', '删除产品', 'products', 'delete', '2025-09-11T02:15:41.492Z', '2025-09-12T06:00:52.638Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcl000itmqwsu9ck4nm', 'boms:read', '查看BOM', 'boms', 'read', '2025-09-11T02:15:41.494Z', '2025-09-12T06:00:52.640Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcm000jtmqwdbsjb5qn', 'boms:create', '创建BOM', 'boms', 'create', '2025-09-11T02:15:41.495Z', '2025-09-12T06:00:52.641Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vco000ktmqwib50px26', 'boms:update', '更新BOM', 'boms', 'update', '2025-09-11T02:15:41.496Z', '2025-09-12T06:00:52.642Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcp000ltmqw1wz1auzs', 'boms:delete', '删除BOM', 'boms', 'delete', '2025-09-11T02:15:41.497Z', '2025-09-12T06:00:52.644Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcq000mtmqwjgwmh7yn', 'processes:read', '查看工艺', 'processes', 'read', '2025-09-11T02:15:41.498Z', '2025-09-12T06:00:52.645Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcr000ntmqwa56jzxih', 'processes:create', '创建工艺', 'processes', 'create', '2025-09-11T02:15:41.500Z', '2025-09-12T06:00:52.646Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcs000otmqw79ogt34r', 'processes:update', '更新工艺', 'processes', 'update', '2025-09-11T02:15:41.501Z', '2025-09-12T06:00:52.647Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcu000ptmqwj58lbtk8', 'processes:delete', '删除工艺', 'processes', 'delete', '2025-09-11T02:15:41.502Z', '2025-09-12T06:00:52.648Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcv000qtmqwxdd99mh5', 'orders:read', '查看订单', 'orders', 'read', '2025-09-11T02:15:41.503Z', '2025-09-12T06:00:52.649Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcw000rtmqw97jko80w', 'orders:create', '创建订单', 'orders', 'create', '2025-09-11T02:15:41.504Z', '2025-09-12T06:00:52.651Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcx000stmqwfo0ao4w6', 'orders:update', '更新订单', 'orders', 'update', '2025-09-11T02:15:41.505Z', '2025-09-12T06:00:52.652Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcy000ttmqwl5bcrbuh', 'orders:delete', '删除订单', 'orders', 'delete', '2025-09-11T02:15:41.506Z', '2025-09-12T06:00:52.653Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vcz000utmqwc6ippwj7', 'orders:execute', '执行订单', 'orders', 'execute', '2025-09-11T02:15:41.507Z', '2025-09-12T06:00:52.654Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd0000vtmqw20f64y4s', 'workstations:read', '查看工位', 'workstations', 'read', '2025-09-11T02:15:41.509Z', '2025-09-12T06:00:52.656Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd2000wtmqwl1kns18y', 'workstations:create', '创建工位', 'workstations', 'create', '2025-09-11T02:15:41.510Z', '2025-09-12T06:00:52.658Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd3000xtmqwjzns7rfy', 'workstations:update', '更新工位', 'workstations', 'update', '2025-09-11T02:15:41.511Z', '2025-09-12T06:00:52.659Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd4000ytmqwe84dw0wq', 'workstations:delete', '删除工位', 'workstations', 'delete', '2025-09-11T02:15:41.513Z', '2025-09-12T06:00:52.660Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd5000ztmqwgmsvt7es', 'workstations:control', '控制工位', 'workstations', 'control', '2025-09-11T02:15:41.514Z', '2025-09-12T06:00:52.662Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd60010tmqwstfx4daf', 'devices:read', '查看设备', 'devices', 'read', '2025-09-11T02:15:41.515Z', '2025-09-12T06:00:52.663Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd80011tmqwldg25n5j', 'devices:create', '创建设备', 'devices', 'create', '2025-09-11T02:15:41.516Z', '2025-09-12T06:00:52.664Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vd90012tmqwvim9w38x', 'devices:update', '更新设备', 'devices', 'update', '2025-09-11T02:15:41.517Z', '2025-09-12T06:00:52.665Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vda0013tmqwt6p7pyj8', 'devices:delete', '删除设备', 'devices', 'delete', '2025-09-11T02:15:41.518Z', '2025-09-12T06:00:52.667Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdb0014tmqwkbxgr86w', 'devices:control', '控制设备', 'devices', 'control', '2025-09-11T02:15:41.519Z', '2025-09-12T06:00:52.668Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdc0015tmqwqmtizzs0', 'clients:read', '查看客户端', 'clients', 'read', '2025-09-11T02:15:41.520Z', '2025-09-12T06:00:52.669Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdd0016tmqwkmvobima', 'clients:create', '创建客户端', 'clients', 'create', '2025-09-11T02:15:41.521Z', '2025-09-12T06:00:52.670Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vde0017tmqwm5rhcsoo', 'clients:update', '更新客户端', 'clients', 'update', '2025-09-11T02:15:41.522Z', '2025-09-12T06:00:52.671Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdf0018tmqwub6kygdf', 'clients:delete', '删除客户端', 'clients', 'delete', '2025-09-11T02:15:41.523Z', '2025-09-12T06:00:52.673Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdg0019tmqwoee509le', 'export:data', '导出数据', 'export', 'data', '2025-09-11T02:15:41.524Z', '2025-09-12T06:00:52.674Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdh001atmqw97l8kr36', 'dashboard:view', '查看仪表盘', 'dashboard', 'view', '2025-09-11T02:15:41.525Z', '2025-09-12T06:00:52.676Z');
INSERT INTO permissions (id, name, description, resource, action, "createdAt", "updatedAt") VALUES ('cmfes0vdi001btmqwr52rnccb', 'system:config', '系统配置', 'system', 'config', '2025-09-11T02:15:41.527Z', '2025-09-12T06:00:52.677Z');

-- 工位数据
INSERT INTO workstations (id, "workstationId", name, description, location, type, "configuredIp", "currentIp", status, "lastConnected", settings, "createdAt", "updatedAt") VALUES ('cmfes0vyl008ptmqwgnshcafo', 'M2', 'M2', '主装配工位', '车间一区', 'VISUAL_CLIENT', '192.168.1.101', NULL, 'offline', NULL, '{"timeout":30000,"retryCount":3,"autoConnect":true}'::jsonb, '2025-09-11T02:15:42.286Z', '2025-09-11T02:58:16.651Z');
INSERT INTO workstations (id, "workstationId", name, description, location, type, "configuredIp", "currentIp", status, "lastConnected", settings, "createdAt", "updatedAt") VALUES ('cmfgfiby20083tm64mj6j5sq8', 'WS-001', '生产工位A', '主装配工位', '车间一区', 'VISUAL_CLIENT', '192.168.1.101', NULL, 'offline', NULL, '{"timeout":30000,"retryCount":3,"autoConnect":true}'::jsonb, '2025-09-12T06:00:53.499Z', '2025-09-12T06:00:53.499Z');
INSERT INTO workstations (id, "workstationId", name, description, location, type, "configuredIp", "currentIp", status, "lastConnected", settings, "createdAt", "updatedAt") VALUES ('cmfes0vyh008otmqwlh0tph5y', 'M1', 'M1', '主装配工位M1', '生产线A', 'VISUAL_CLIENT', '192.168.124.5', NULL, 'offline', '2025-09-11T09:11:33.331Z', '{"timeout":30000,"retryCount":3,"autoConnect":true}'::jsonb, '2025-09-11T02:15:42.282Z', '2025-09-13T13:47:54.865Z');

-- 设备模板数据
INSERT INTO device_templates (id, "templateId", name, type, brand, model, driver, description, capabilities, "configSchema", "createdAt", "updatedAt") VALUES ('cmfes0vyo008qtmqwsq6sa0aw', 'PLC_SIEMENS_S7_1200', 'PLC SIEMENS', 'PLC_CONTROLLER', 'SIEMENS', 'S7_1200', 'siemens_s7', 'Siemens S7-1200 PLC Controller', '{"read":true,"write":true,"monitoring":true}'::jsonb, '{"rack":{"type":"number","default":0,"description":"PLC机架号"},"slot":{"type":"number","default":1,"description":"PLC插槽号"}}'::jsonb, '2025-09-11T02:15:42.288Z', '2025-09-12T06:00:53.502Z');
INSERT INTO device_templates (id, "templateId", name, type, brand, model, driver, description, capabilities, "configSchema", "createdAt", "updatedAt") VALUES ('cmfes0vys008rtmqwfmomr863', 'BARCODE_SCANNER_HONEYWELL', '扫码器', 'BARCODE_SCANNER', 'Honeywell', 'Voyager 1200g', 'honeywell_voyager', 'Honeywell Voyager 1200g Barcode Scanner', '{"scan":true,"continuous_scan":true}'::jsonb, '{"timeout":{"type":"number","default":5000,"description":"扫描超时时间(ms)"}}'::jsonb, '2025-09-11T02:15:42.292Z', '2025-09-12T06:00:53.504Z');

-- 工位设备数据
INSERT INTO workstation_devices (id, "instanceId", "workstationId", "templateId", "displayName", "ipAddress", port, protocol, "connectionString", config, status, "isOnline", "lastConnected", "lastHeartbeat", "createdAt", "updatedAt") VALUES ('cmfgfmq150004tmgol5g5i05z', 'cmfgfmq150005tmgo0yux6br0', 'cmfes0vyh008otmqwlh0tph5y', 'cmfes0vyo008qtmqwsq6sa0aw', 'PLC_127.0.0.1', '127.0.0.1', 102, 'TCP', NULL, '{"rack":0,"slot":1,"plcType":"Siemens_S7"}'::jsonb, 'ONLINE', false, NULL, '2025-09-15T03:31:04.921Z', '2025-09-12T06:04:18.377Z', '2025-09-15T03:31:04.922Z');
INSERT INTO workstation_devices (id, "instanceId", "workstationId", "templateId", "displayName", "ipAddress", port, protocol, "connectionString", config, status, "isOnline", "lastConnected", "lastHeartbeat", "createdAt", "updatedAt") VALUES ('cmfgwqoi50007tm3otr9z6khw', 'cmfgwqoi50008tm3o2gabu2f6', 'cmfes0vyh008otmqwlh0tph5y', 'cmfes0vyo008qtmqwsq6sa0aw', 'PLC_PAS', '10.102.10.73', 102, 'TCP', NULL, '{"rack":0,"slot":1,"plcType":"Siemens_S7"}'::jsonb, 'ONLINE', false, NULL, '2025-09-15T03:34:57.859Z', '2025-09-12T14:03:16.493Z', '2025-09-15T03:34:57.861Z');

-- 产品数据
INSERT INTO products (id, "productCode", name, description, version, status, "createdAt", "updatedAt") VALUES ('cmfez0qk9000btmu8632w00au', '174', '174', NULL, '1.0', 'active', '2025-09-11T05:31:32.602Z', '2025-09-11T05:34:03.083Z');

-- 菜单数据
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vk3007itmqw2at6c4qq', '仪表盘', '/admin/dashboard', '📊', NULL, 1, 'dashboard:view', 'active', '2025-09-11T02:15:41.763Z', '2025-09-12T06:00:52.928Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vk5007ktmqwgftqqtey', '生产订单', '/admin/orders', '📋', NULL, 2, 'orders:read', 'active', '2025-09-11T02:15:41.766Z', '2025-09-12T06:00:52.939Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vk7007mtmqwopc8nd6b', '产品管理', '/admin/products', '📦', NULL, 3, 'products:read', 'active', '2025-09-11T02:15:41.768Z', '2025-09-12T06:00:52.943Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vk9007otmqwgxxuv6jl', 'BOM管理', '/admin/boms', '📝', NULL, 4, 'boms:read', 'active', '2025-09-11T02:15:41.770Z', '2025-09-12T06:00:52.945Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkb007qtmqwmtetnvji', '工艺管理', '/admin/processes', '⚙️', NULL, 5, 'processes:read', 'active', '2025-09-11T02:15:41.771Z', '2025-09-12T06:00:52.948Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkd007stmqwpv2sgrqf', '工位管理', '/admin/workstations', '🏭', NULL, 6, 'workstations:read', 'active', '2025-09-11T02:15:41.773Z', '2025-09-12T06:00:52.951Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkf007utmqw86m4b8oc', '设备管理', '/admin/devices', '🔧', NULL, 7, 'devices:read', 'active', '2025-09-11T02:15:41.775Z', '2025-09-12T06:00:52.953Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkh007wtmqwyb0718gy', '设备通信管理', '/admin/device-communication', '📡', NULL, 8, 'devices:control', 'active', '2025-09-11T02:15:41.777Z', '2025-09-12T06:00:52.957Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkj007ytmqwdurkcidv', '数据导出', '/admin/export', '📤', NULL, 9, 'export:data', 'active', '2025-09-11T02:15:41.779Z', '2025-09-12T06:00:52.959Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkl0080tmqwic8m8kbg', '系统管理', NULL, '🔧', NULL, 10, 'users:read,roles:read,menus:read', 'active', '2025-09-11T02:15:41.781Z', '2025-09-12T06:00:52.962Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vku0088tmqwste6wdn3', '客户端配置', '/admin/clients', '💻', NULL, 11, 'clients:read', 'active', '2025-09-11T02:15:41.791Z', '2025-09-12T06:00:52.972Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkn0082tmqw90gjwkjk', '菜单管理', '/admin/menus', '📋', 'cmfes0vkl0080tmqwic8m8kbg', 1, 'menus:read', 'active', '2025-09-11T02:15:41.783Z', '2025-09-12T06:00:52.974Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfgfibj9007itm6425vbhu1p', '菜单管理', '/admin/menus', '📋', 'cmfes0vkl0080tmqwic8m8kbg', 1, 'menus:read', 'active', '2025-09-12T06:00:52.965Z', '2025-09-12T06:00:52.974Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vkp0084tmqw62bpvqzm', '用户管理', '/admin/users', '👥', 'cmfes0vkl0080tmqwic8m8kbg', 2, 'users:read', 'active', '2025-09-11T02:15:41.785Z', '2025-09-12T06:00:52.977Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfgfibjb007ktm64adzl6rfd', '用户管理', '/admin/users', '👥', 'cmfes0vkl0080tmqwic8m8kbg', 2, 'users:read', 'active', '2025-09-12T06:00:52.967Z', '2025-09-12T06:00:52.977Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfes0vks0086tmqwge45u8wa', '角色权限', '/admin/roles', '🔐', 'cmfes0vkl0080tmqwic8m8kbg', 3, 'roles:read', 'active', '2025-09-11T02:15:41.788Z', '2025-09-12T06:00:52.979Z');
INSERT INTO menus (id, name, path, icon, "parentId", "order", permissions, status, "createdAt", "updatedAt") VALUES ('cmfgfibjd007mtm64oktj2qzv', '角色权限', '/admin/roles', '🔐', 'cmfes0vkl0080tmqwic8m8kbg', 3, 'roles:read', 'active', '2025-09-12T06:00:52.970Z', '2025-09-12T06:00:52.979Z');

-- ========================================
-- 数据导出完成
-- 导出时间: 2025-09-15T03:54:35.968Z
-- ========================================
