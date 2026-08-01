-- CreateEnum
CREATE TYPE "HandoverType" AS ENUM ('checkout', 'checkin');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "targetId" TEXT,
ADD COLUMN     "targetType" TEXT;

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "EquipmentCategory",
    "governorate" TEXT,
    "listingType" "ListingType",
    "keyword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_records" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "otherPartyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "HandoverType" NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handover_records_equipmentId_otherPartyId_idx" ON "handover_records"("equipmentId", "otherPartyId");

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_otherPartyId_fkey" FOREIGN KEY ("otherPartyId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
