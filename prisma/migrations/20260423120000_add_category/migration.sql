ALTER TABLE "ShowHnPost" ADD COLUMN "category" TEXT;
CREATE INDEX "ShowHnPost_category_idx" ON "ShowHnPost"("category");
