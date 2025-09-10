-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuredIp" TEXT NOT NULL,
    "currentIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastConnected" DATETIME,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workstations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'VISUAL_CLIENT',
    "configuredIp" TEXT NOT NULL,
    "currentIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastConnected" DATETIME,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "driver" TEXT,
    "description" TEXT,
    "workstationId" TEXT,
    "ipAddress" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "connectionString" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" DATETIME,
    "lastHeartbeat" DATETIME,
    "settings" JSONB,
    "capabilities" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "devices_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "device_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "driver" TEXT,
    "description" TEXT,
    "capabilities" JSONB,
    "configSchema" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workstation_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT DEFAULT 'TCP',
    "connectionString" TEXT,
    "config" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" DATETIME,
    "lastHeartbeat" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workstation_devices_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "device_templates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "workstation_devices_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "menus" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workstation_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "loginTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedDevices" JSONB,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workstation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workstation_sessions_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workstation_work_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workstationId" TEXT NOT NULL,
    "workState" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workstation_work_states_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "product_workstations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_workstations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_workstations_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "boms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "productId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "boms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "bom_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sapDescription" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "processes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processId" TEXT NOT NULL,
    "stepTemplateId" TEXT,
    "stepCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "estimatedTime" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "steps_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "steps_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "step_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "steps_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "step_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "workstationType" TEXT,
    "workstationId" TEXT,
    "description" TEXT,
    "instructions" TEXT,
    "image" TEXT,
    "estimatedTime" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "step_templates_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "step_conditions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepTemplateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "step_conditions_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "step_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepId" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "deviceId" TEXT,
    "deviceAddress" TEXT,
    "expectedValue" TEXT,
    "validationRule" TEXT,
    "parameters" JSONB,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "actions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "actions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "action_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepTemplateId" TEXT,
    "actionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "deviceType" TEXT,
    "deviceAddress" TEXT,
    "expectedValue" TEXT,
    "validationRule" TEXT,
    "parameters" JSONB,
    "description" TEXT,
    "instructions" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "action_templates_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "step_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "productionNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT,
    "processId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plannedDate" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "currentStationId" TEXT,
    "currentStepId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "importSource" TEXT DEFAULT 'manual',
    "importBatch" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "boms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_currentStationId_fkey" FOREIGN KEY ("currentStationId") REFERENCES "workstations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "steps" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "workstationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "executedBy" TEXT,
    "actualTime" INTEGER,
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "order_steps_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_steps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_steps_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderStepId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedBy" TEXT,
    "deviceId" TEXT,
    "requestValue" TEXT,
    "responseValue" TEXT,
    "actualValue" TEXT,
    "validationResult" BOOLEAN,
    "executionTime" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "parameters" JSONB,
    "result" JSONB,
    CONSTRAINT "action_logs_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "actions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "action_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "action_logs_orderStepId_fkey" FOREIGN KEY ("orderStepId") REFERENCES "order_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,
    CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "data_export_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exportType" TEXT NOT NULL,
    "exportScope" TEXT NOT NULL,
    "filters" JSONB,
    "fileSize" INTEGER,
    "filePath" TEXT,
    "recordCount" INTEGER,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "exportedBy" TEXT,
    "exportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_roleId_key" ON "user_role_assignments"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientId_key" ON "clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "workstations_workstationId_key" ON "workstations"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceId_key" ON "devices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "device_templates_templateId_key" ON "device_templates"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_instanceId_key" ON "workstation_devices"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_workstationId_instanceId_key" ON "workstation_devices"("workstationId", "instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_sessions_sessionId_key" ON "workstation_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_work_states_workstationId_key" ON "workstation_work_states"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "products"("productCode");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_workstations_productId_workstationId_key" ON "product_workstations"("productId", "workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_workstations_productId_sequence_key" ON "product_workstations"("productId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "boms_bomCode_key" ON "boms"("bomCode");

-- CreateIndex
CREATE UNIQUE INDEX "parts_partNumber_key" ON "parts"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "processes_processCode_key" ON "processes"("processCode");

-- CreateIndex
CREATE INDEX "processes_productId_idx" ON "processes"("productId");

-- CreateIndex
CREATE INDEX "processes_status_idx" ON "processes"("status");

-- CreateIndex
CREATE INDEX "processes_createdAt_idx" ON "processes"("createdAt");

-- CreateIndex
CREATE INDEX "steps_processId_idx" ON "steps"("processId");

-- CreateIndex
CREATE INDEX "steps_workstationId_idx" ON "steps"("workstationId");

-- CreateIndex
CREATE INDEX "steps_stepTemplateId_idx" ON "steps"("stepTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "steps_processId_sequence_key" ON "steps"("processId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "step_templates_stepCode_key" ON "step_templates"("stepCode");

-- CreateIndex
CREATE INDEX "step_templates_status_idx" ON "step_templates"("status");

-- CreateIndex
CREATE INDEX "step_templates_workstationId_idx" ON "step_templates"("workstationId");

-- CreateIndex
CREATE INDEX "step_templates_category_idx" ON "step_templates"("category");

-- CreateIndex
CREATE INDEX "actions_stepId_idx" ON "actions"("stepId");

-- CreateIndex
CREATE INDEX "actions_deviceId_idx" ON "actions"("deviceId");

-- CreateIndex
CREATE INDEX "actions_type_idx" ON "actions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "actions_stepId_sequence_key" ON "actions"("stepId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "action_templates_actionCode_key" ON "action_templates"("actionCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_productId_idx" ON "orders"("productId");

-- CreateIndex
CREATE INDEX "orders_processId_idx" ON "orders"("processId");

-- CreateIndex
CREATE INDEX "orders_plannedDate_idx" ON "orders"("plannedDate");

-- CreateIndex
CREATE INDEX "orders_priority_idx" ON "orders"("priority");

-- CreateIndex
CREATE INDEX "orders_currentStationId_idx" ON "orders"("currentStationId");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_steps_orderId_idx" ON "order_steps"("orderId");

-- CreateIndex
CREATE INDEX "order_steps_stepId_idx" ON "order_steps"("stepId");

-- CreateIndex
CREATE INDEX "order_steps_status_idx" ON "order_steps"("status");

-- CreateIndex
CREATE INDEX "order_steps_workstationId_idx" ON "order_steps"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "order_steps_orderId_stepId_key" ON "order_steps"("orderId", "stepId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");
