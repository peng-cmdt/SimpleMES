-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'SUPERVISOR', 'ENGINEER', 'OPERATOR', 'USER', 'CLIENT');

-- CreateEnum
CREATE TYPE "public"."DeviceType" AS ENUM ('PLC_CONTROLLER', 'SCREWDRIVER', 'BARCODE_SCANNER', 'SENSOR', 'CAMERA', 'PRINTER', 'ROBOT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "public"."WorkstationType" AS ENUM ('VISUAL_CLIENT', 'SERVICE_TYPE');

-- CreateEnum
CREATE TYPE "public"."ConditionType" AS ENUM ('BOM_CHECK', 'PART_CHECK', 'PRODUCT_CHECK', 'QUANTITY_CHECK', 'CUSTOM_FIELD');

-- CreateEnum
CREATE TYPE "public"."ActionType" AS ENUM ('DEVICE_READ', 'DEVICE_WRITE', 'MANUAL_CONFIRM', 'DATA_VALIDATION', 'DELAY_WAIT', 'BARCODE_SCAN', 'CAMERA_CHECK', 'CUSTOM_SCRIPT');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED', 'ERROR');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT,
    "avatar" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'OPERATOR',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clients" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configuredIp" TEXT NOT NULL,
    "currentIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastConnected" TIMESTAMP(3),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workstations" (
    "id" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "type" "public"."WorkstationType" NOT NULL DEFAULT 'VISUAL_CLIENT',
    "configuredIp" TEXT NOT NULL,
    "currentIp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastConnected" TIMESTAMP(3),
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."devices" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."DeviceType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "driver" TEXT,
    "description" TEXT,
    "workstationId" TEXT,
    "ipAddress" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "connectionString" TEXT,
    "status" "public"."DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "settings" JSONB,
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."menus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "permissions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workstation_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT,
    "loginTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logoutTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectedDevices" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_workstations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_workstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."boms" (
    "id" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "productId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bom_items" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."parts" (
    "id" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sapDescription" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processes" (
    "id" TEXT NOT NULL,
    "processCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."steps" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "stepTemplateId" TEXT,
    "stepCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workstationId" TEXT,
    "sequence" INTEGER NOT NULL,
    "description" TEXT,
    "estimatedTime" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_templates" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."step_conditions" (
    "id" TEXT NOT NULL,
    "stepTemplateId" TEXT NOT NULL,
    "type" "public"."ConditionType" NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."actions" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "actionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ActionType" NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."action_templates" (
    "id" TEXT NOT NULL,
    "stepTemplateId" TEXT,
    "actionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ActionType" NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "productionNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT,
    "processId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "plannedDate" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "currentStationId" TEXT,
    "currentStepId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "importSource" TEXT DEFAULT 'manual',
    "importBatch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_steps" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "workstationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "executedBy" TEXT,
    "actualTime" INTEGER,
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."action_logs" (
    "id" TEXT NOT NULL,
    "orderStepId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "notes" TEXT,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_export_records" (
    "id" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "exportScope" TEXT NOT NULL,
    "filters" JSONB,
    "fileSize" INTEGER,
    "filePath" TEXT,
    "recordCount" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "exportedBy" TEXT,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,

    CONSTRAINT "data_export_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_userId_roleId_key" ON "public"."user_role_assignments"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "public"."role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "clients_clientId_key" ON "public"."clients"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "workstations_workstationId_key" ON "public"."workstations"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_deviceId_key" ON "public"."devices"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_sessions_sessionId_key" ON "public"."workstation_sessions"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "public"."products"("productCode");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "public"."products"("status");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "public"."products"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_workstations_productId_workstationId_key" ON "public"."product_workstations"("productId", "workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_workstations_productId_sequence_key" ON "public"."product_workstations"("productId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "boms_bomCode_key" ON "public"."boms"("bomCode");

-- CreateIndex
CREATE UNIQUE INDEX "parts_partNumber_key" ON "public"."parts"("partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "processes_processCode_key" ON "public"."processes"("processCode");

-- CreateIndex
CREATE INDEX "processes_productId_idx" ON "public"."processes"("productId");

-- CreateIndex
CREATE INDEX "processes_status_idx" ON "public"."processes"("status");

-- CreateIndex
CREATE INDEX "processes_createdAt_idx" ON "public"."processes"("createdAt");

-- CreateIndex
CREATE INDEX "steps_processId_idx" ON "public"."steps"("processId");

-- CreateIndex
CREATE INDEX "steps_workstationId_idx" ON "public"."steps"("workstationId");

-- CreateIndex
CREATE INDEX "steps_stepTemplateId_idx" ON "public"."steps"("stepTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "steps_processId_sequence_key" ON "public"."steps"("processId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "step_templates_stepCode_key" ON "public"."step_templates"("stepCode");

-- CreateIndex
CREATE INDEX "step_templates_status_idx" ON "public"."step_templates"("status");

-- CreateIndex
CREATE INDEX "step_templates_workstationId_idx" ON "public"."step_templates"("workstationId");

-- CreateIndex
CREATE INDEX "step_templates_category_idx" ON "public"."step_templates"("category");

-- CreateIndex
CREATE INDEX "actions_stepId_idx" ON "public"."actions"("stepId");

-- CreateIndex
CREATE INDEX "actions_deviceId_idx" ON "public"."actions"("deviceId");

-- CreateIndex
CREATE INDEX "actions_type_idx" ON "public"."actions"("type");

-- CreateIndex
CREATE UNIQUE INDEX "actions_stepId_sequence_key" ON "public"."actions"("stepId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "action_templates_actionCode_key" ON "public"."action_templates"("actionCode");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "public"."orders"("orderNumber");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status");

-- CreateIndex
CREATE INDEX "orders_productId_idx" ON "public"."orders"("productId");

-- CreateIndex
CREATE INDEX "orders_processId_idx" ON "public"."orders"("processId");

-- CreateIndex
CREATE INDEX "orders_plannedDate_idx" ON "public"."orders"("plannedDate");

-- CreateIndex
CREATE INDEX "orders_priority_idx" ON "public"."orders"("priority");

-- CreateIndex
CREATE INDEX "orders_currentStationId_idx" ON "public"."orders"("currentStationId");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "public"."orders"("createdAt");

-- CreateIndex
CREATE INDEX "order_steps_orderId_idx" ON "public"."order_steps"("orderId");

-- CreateIndex
CREATE INDEX "order_steps_stepId_idx" ON "public"."order_steps"("stepId");

-- CreateIndex
CREATE INDEX "order_steps_status_idx" ON "public"."order_steps"("status");

-- CreateIndex
CREATE INDEX "order_steps_workstationId_idx" ON "public"."order_steps"("workstationId");

-- CreateIndex
CREATE UNIQUE INDEX "order_steps_orderId_stepId_key" ON "public"."order_steps"("orderId", "stepId");

-- AddForeignKey
ALTER TABLE "public"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_role_assignments" ADD CONSTRAINT "user_role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."devices" ADD CONSTRAINT "devices_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."menus" ADD CONSTRAINT "menus_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workstation_sessions" ADD CONSTRAINT "workstation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workstation_sessions" ADD CONSTRAINT "workstation_sessions_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_workstations" ADD CONSTRAINT "product_workstations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_workstations" ADD CONSTRAINT "product_workstations_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."boms" ADD CONSTRAINT "boms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bom_items" ADD CONSTRAINT "bom_items_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "public"."boms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processes" ADD CONSTRAINT "processes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."steps" ADD CONSTRAINT "steps_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."steps" ADD CONSTRAINT "steps_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "public"."step_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."steps" ADD CONSTRAINT "steps_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_templates" ADD CONSTRAINT "step_templates_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."step_conditions" ADD CONSTRAINT "step_conditions_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "public"."step_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."actions" ADD CONSTRAINT "actions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."action_templates" ADD CONSTRAINT "action_templates_stepTemplateId_fkey" FOREIGN KEY ("stepTemplateId") REFERENCES "public"."step_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "public"."boms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_currentStationId_fkey" FOREIGN KEY ("currentStationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "public"."steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_steps" ADD CONSTRAINT "order_steps_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_steps" ADD CONSTRAINT "order_steps_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "public"."steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_steps" ADD CONSTRAINT "order_steps_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."action_logs" ADD CONSTRAINT "action_logs_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "public"."actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."action_logs" ADD CONSTRAINT "action_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "public"."devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."action_logs" ADD CONSTRAINT "action_logs_orderStepId_fkey" FOREIGN KEY ("orderStepId") REFERENCES "public"."order_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
