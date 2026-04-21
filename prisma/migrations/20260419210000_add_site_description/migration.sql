ALTER TABLE "ShowHnPost"
  ADD COLUMN "siteDescription" TEXT;

-- Reset previewFetchedAt so the Inngest preview job re-scrapes each URL
-- and populates siteDescription for existing rows.
UPDATE "ShowHnPost"
  SET "previewFetchedAt" = NULL
  WHERE "siteDescription" IS NULL;
