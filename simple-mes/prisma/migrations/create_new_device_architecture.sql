/*
  新设备架构迁移
  分离设备抽象定义和工位设备实例
*/

-- CreateTable: 设备模板表 (抽象设备定义)
CREATE TABLE "device_templates" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "driver" TEXT,
    "description" TEXT,
    "capabilities" JSONB,
    "configSchema" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 工位设备实例表
CREATE TABLE "workstation_devices" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT DEFAULT 'TCP',
    "connectionString" TEXT,
    "config" JSONB,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstation_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_templates_templateId_key" ON "device_templates"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_instanceId_key" ON "workstation_devices"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_workstationId_instanceId_key" ON "workstation_devices"("workstationId", "instanceId");

-- AddForeignKey
ALTER TABLE "workstation_devices" ADD CONSTRAINT "workstation_devices_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workstation_devices" ADD CONSTRAINT "workstation_devices_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "device_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;