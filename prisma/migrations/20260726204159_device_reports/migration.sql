-- CreateEnum
CREATE TYPE "DeviceReportStatus" AS ENUM ('stolen', 'lost');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "device_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "brand" TEXT,
    "serialNumber" TEXT NOT NULL,
    "status" "DeviceReportStatus" NOT NULL,
    "details" TEXT,
    "contactPhone" TEXT,
    "policeReportUrl" TEXT,
    "ownershipDocUrl" TEXT,
    "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_reports_serialNumber_idx" ON "device_reports"("serialNumber");

-- AddForeignKey
ALTER TABLE "device_reports" ADD CONSTRAINT "device_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
