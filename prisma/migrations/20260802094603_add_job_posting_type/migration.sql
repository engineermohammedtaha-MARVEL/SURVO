-- CreateEnum
CREATE TYPE "JobPostingType" AS ENUM ('hiring', 'offering');

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "postingType" "JobPostingType" NOT NULL DEFAULT 'hiring';
