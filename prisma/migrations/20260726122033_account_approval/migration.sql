-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'approved';
