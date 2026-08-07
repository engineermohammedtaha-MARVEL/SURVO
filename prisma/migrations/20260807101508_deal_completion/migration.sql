-- AlterEnum
ALTER TYPE "DealStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "otherPartyEnded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerEnded" BOOLEAN NOT NULL DEFAULT false;
