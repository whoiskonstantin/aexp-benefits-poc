-- CreateTable
CREATE TABLE "crawl_sessions" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "pagesScraped" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "crawl_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_steps" (
    "id" SERIAL NOT NULL,
    "crawlSessionId" INTEGER NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "depth" INTEGER NOT NULL,
    "parentUrl" VARCHAR(2048),
    "linkText" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scraped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "navigation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_sessions_startedAt_idx" ON "crawl_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "navigation_steps_crawlSessionId_idx" ON "navigation_steps"("crawlSessionId");

-- CreateIndex
CREATE INDEX "navigation_steps_depth_idx" ON "navigation_steps"("depth");

-- AddForeignKey
ALTER TABLE "navigation_steps" ADD CONSTRAINT "navigation_steps_crawlSessionId_fkey" FOREIGN KEY ("crawlSessionId") REFERENCES "crawl_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
