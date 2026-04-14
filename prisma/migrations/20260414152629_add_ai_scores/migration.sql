-- AlterTable
ALTER TABLE "ShowHnPost" ADD COLUMN     "aiScore" INTEGER,
ADD COLUMN     "aiScoreDetails" JSONB,
ADD COLUMN     "aiSummary" TEXT;
