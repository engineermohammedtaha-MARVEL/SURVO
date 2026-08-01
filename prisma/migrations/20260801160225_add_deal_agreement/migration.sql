-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('sale', 'rent');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "otherPartyId" TEXT NOT NULL,
    "dealType" "DealType" NOT NULL,
    "proposedById" TEXT NOT NULL,
    "ownerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "otherPartyConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "DealStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deals_equipmentId_otherPartyId_key" ON "deals"("equipmentId", "otherPartyId");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_otherPartyId_fkey" FOREIGN KEY ("otherPartyId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
