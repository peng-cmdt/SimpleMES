-- CreateTable
CREATE TABLE "public"."device_templates" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."DeviceType" NOT NULL,
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

-- CreateTable
CREATE TABLE "public"."workstation_devices" (
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
    "status" "public"."DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastConnected" TIMESTAMP(3),
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstation_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_templates_templateId_key" ON "public"."device_templates"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_instanceId_key" ON "public"."workstation_devices"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_devices_workstationId_instanceId_key" ON "public"."workstation_devices"("workstationId", "instanceId");

-- AddForeignKey
ALTER TABLE "public"."workstation_devices" ADD CONSTRAINT "workstation_devices_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workstation_devices" ADD CONSTRAINT "workstation_devices_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."device_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
