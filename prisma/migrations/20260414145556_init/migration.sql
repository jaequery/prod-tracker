-- CreateTable
CREATE TABLE "ShowHnPost" (
    "id" SERIAL NOT NULL,
    "hnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "numComments" INTEGER NOT NULL,
    "upvotes" INTEGER NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowHnPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowHnPost_hnId_key" ON "ShowHnPost"("hnId");
