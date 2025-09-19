-- CreateEnum
CREATE TYPE "public"."WorkstationOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED');

-- CreateTable
CREATE TABLE "public"."workstation_order_queues" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "status" "public"."WorkstationOrderStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstation_order_queues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workstation_order_queues_workstationId_status_idx" ON "public"."workstation_order_queues"("workstationId", "status");

-- CreateIndex
CREATE INDEX "workstation_order_queues_orderId_idx" ON "public"."workstation_order_queues"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "workstation_order_queues_orderId_workstationId_key" ON "public"."workstation_order_queues"("orderId", "workstationId");

-- AddForeignKey
ALTER TABLE "public"."workstation_order_queues" ADD CONSTRAINT "workstation_order_queues_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workstation_order_queues" ADD CONSTRAINT "workstation_order_queues_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
