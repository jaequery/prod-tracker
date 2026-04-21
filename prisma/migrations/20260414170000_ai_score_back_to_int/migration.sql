-- AlterTable: change aiScore from String back to Int
ALTER TABLE "ShowHnPost" ALTER COLUMN "aiScore" TYPE INTEGER USING NULL;
