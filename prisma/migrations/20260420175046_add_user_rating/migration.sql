-- CreateTable
CREATE TABLE "UserRating" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRating_postId_key" ON "UserRating"("postId");

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ShowHnPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
