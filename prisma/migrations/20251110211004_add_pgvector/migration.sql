-- CreateTable
CREATE TABLE "pages" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" SERIAL NOT NULL,
    "pageId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" TEXT,
    "category" TEXT NOT NULL,
    "sourceUrl" VARCHAR(2048) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_url_key" ON "pages"("url");

-- CreateIndex
CREATE INDEX "chunks_pageId_idx" ON "chunks"("pageId");

-- CreateIndex
CREATE INDEX "chunks_category_idx" ON "chunks"("category");

-- CreateIndex
CREATE INDEX "admin_logs_createdAt_idx" ON "admin_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_logs_action_idx" ON "admin_logs"("action");

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
