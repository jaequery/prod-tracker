ALTER TABLE "ShowHnPost" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'show_hn';
CREATE INDEX "ShowHnPost_source_idx" ON "ShowHnPost"("source");
