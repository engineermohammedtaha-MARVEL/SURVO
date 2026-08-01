-- AlterTable
ALTER TABLE "handover_records" ADD COLUMN     "certificateUrl" TEXT,
ADD COLUMN     "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[];
