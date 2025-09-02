-- CreateTable
CREATE TABLE "public"."workstation_work_states" (
    "id" TEXT NOT NULL,
    "workstationId" TEXT NOT NULL,
    "workState" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstation_work_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workstation_work_states_workstationId_key" ON "public"."workstation_work_states"("workstationId");

-- AddForeignKey
ALTER TABLE "public"."workstation_work_states" ADD CONSTRAINT "workstation_work_states_workstationId_fkey" FOREIGN KEY ("workstationId") REFERENCES "public"."workstations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
