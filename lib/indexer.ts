import prisma from './prisma'
import { crawlBenefitsPages } from './scraper'
import { chunkPages, printChunkingStats } from './chunking'
import { generateEmbeddingsBatched, embeddingToString } from './embeddings'

/**
 * Reindex all benefit content
 * This is the main orchestration function
 */
export async function reindexContent(): Promise<{
  pagesIndexed: number
  chunksCreated: number
  embeddingsGenerated: number
  duration: number
  crawlSessionId: number
  navigationSteps: number
}> {
  const startTime = Date.now()
  let crawlSession: any = null

  try {
    console.log('\n========================================')
    console.log('Starting content reindexing...')
    console.log('========================================\n')

    // Step 1: Create crawl session
    console.log('Step 1: Creating crawl session...')
    crawlSession = await prisma.crawlSession.create({
      data: {
        startedAt: new Date(),
        status: 'in_progress',
        pagesScraped: 0,
      },
    })
    console.log(`✓ Created crawl session #${crawlSession.id}\n`)

    // Step 2: Crawl benefits pages
    console.log('Step 2: Crawling benefits pages...')
    const crawlResult = await crawlBenefitsPages()
    console.log(`✓ Crawled ${crawlResult.pages.length} pages\n`)

    if (crawlResult.pages.length === 0) {
      console.warn('No pages crawled. Marking session as failed.')
      await prisma.crawlSession.update({
        where: { id: crawlSession.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      })
      return {
        pagesIndexed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        duration: 0,
        crawlSessionId: crawlSession.id,
        navigationSteps: 0,
      }
    }

    // Step 3: Save navigation steps to database
    console.log('Step 3: Saving navigation steps...')
    await prisma.navigationStep.createMany({
      data: crawlResult.navigationSteps.map(step => ({
        crawlSessionId: crawlSession.id,
        url: step.url,
        depth: step.depth,
        parentUrl: step.parentUrl,
        linkText: step.linkText,
        visitedAt: step.visitedAt,
        scraped: step.scraped,
      })),
    })
    console.log(`✓ Saved ${crawlResult.navigationSteps.length} navigation steps\n`)

    // Update crawl session with pages scraped count
    await prisma.crawlSession.update({
      where: { id: crawlSession.id },
      data: {
        pagesScraped: crawlResult.pages.length,
      },
    })

    const scrapedPages = crawlResult.pages

    // Step 4: Chunk content
    console.log('Step 4: Chunking content...')
    const chunkedPages = chunkPages(scrapedPages)
    printChunkingStats(chunkedPages)

    // Step 5: Clear old data
    console.log('Step 5: Clearing old data from database...')
    const deletedChunks = await prisma.chunk.deleteMany({})
    const deletedPages = await prisma.page.deleteMany({})
    console.log(`✓ Deleted ${deletedChunks.count} chunks and ${deletedPages.count} pages\n`)

    // Step 6: Store pages and chunks
    console.log('Step 6: Storing pages in database...')
    const storedPages = await Promise.all(
      scrapedPages.map(page =>
        prisma.page.create({
          data: {
            url: page.url,
            title: page.title,
            crawledAt: new Date(),
          },
        })
      )
    )
    console.log(`✓ Stored ${storedPages.length} pages\n`)

    // Step 7: Generate embeddings for all chunks
    console.log('Step 7: Generating embeddings...')
    const allChunks = chunkedPages.flatMap(p => p.chunks)
    const allChunkTexts = allChunks.map(chunk => chunk.text)

    const embeddings = await generateEmbeddingsBatched(allChunkTexts, 50)
    console.log(`✓ Generated ${embeddings.length} embeddings\n`)

    // Step 8: Store chunks with embeddings
    console.log('Step 8: Storing chunks with embeddings...')
    let chunksStored = 0

    for (let i = 0; i < chunkedPages.length; i++) {
      const chunkedPage = chunkedPages[i]
      const page = storedPages[i]

      for (let j = 0; j < chunkedPage.chunks.length; j++) {
        const chunk = chunkedPage.chunks[j]
        const embeddingIndex = chunkedPages
          .slice(0, i)
          .reduce((sum, p) => sum + p.chunks.length, 0) + j

        await prisma.chunk.create({
          data: {
            pageId: page.id,
            text: chunk.text,
            embedding: embeddingToString(embeddings[embeddingIndex]),
            category: chunk.category,
            sourceUrl: chunk.sourceUrl,
          },
        })

        chunksStored++
      }
    }
    console.log(`✓ Stored ${chunksStored} chunks with embeddings\n`)

    // Step 9: Mark crawl session as completed
    console.log('Step 9: Updating crawl session status...')
    await prisma.crawlSession.update({
      where: { id: crawlSession.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    })
    console.log(`✓ Marked crawl session #${crawlSession.id} as completed\n`)

    // Step 10: Log the reindex action
    await prisma.adminLog.create({
      data: {
        action: 'reindex',
        status: 'success',
        message: `Indexed ${scrapedPages.length} pages into ${chunksStored} chunks with embeddings`,
        metadata: {
          pagesIndexed: scrapedPages.length,
          chunksCreated: chunksStored,
          embeddingsGenerated: embeddings.length,
          crawlSessionId: crawlSession.id,
          navigationSteps: crawlResult.navigationSteps.length,
        },
      },
    })

    const duration = Date.now() - startTime
    console.log('\n========================================')
    console.log('✓ Reindexing completed successfully!')
    console.log('========================================')
    console.log(`Pages indexed: ${scrapedPages.length}`)
    console.log(`Chunks created: ${chunksStored}`)
    console.log(`Embeddings generated: ${embeddings.length}`)
    console.log(`Navigation steps: ${crawlResult.navigationSteps.length}`)
    console.log(`Crawl session ID: ${crawlSession.id}`)
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s\n`)

    return {
      pagesIndexed: scrapedPages.length,
      chunksCreated: chunksStored,
      embeddingsGenerated: embeddings.length,
      duration,
      crawlSessionId: crawlSession.id,
      navigationSteps: crawlResult.navigationSteps.length,
    }
  } catch (error) {
    console.error('Error during reindexing:', error)

    // Mark crawl session as failed if it was created
    if (crawlSession) {
      await prisma.crawlSession.update({
        where: { id: crawlSession.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
        },
      }).catch(console.error)
    }

    // Log the error
    await prisma.adminLog.create({
      data: {
        action: 'reindex',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          crawlSessionId: crawlSession?.id,
        },
      },
    })

    throw error
  }
}

/**
 * Get reindexing status from database
 */
export async function getReindexStatus(): Promise<{
  lastReindexAt: Date | null
  lastReindexStatus: string | null
  totalPages: number
  totalChunks: number
  totalEmbeddings: number
}> {
  const lastLog = await prisma.adminLog.findFirst({
    where: { action: 'reindex' },
    orderBy: { createdAt: 'desc' },
  })

  const totalPages = await prisma.page.count()
  const totalChunks = await prisma.chunk.count()
  const chunksWithEmbeddings = await prisma.chunk.count({
    where: { embedding: { not: null } },
  })

  return {
    lastReindexAt: lastLog?.createdAt || null,
    lastReindexStatus: lastLog?.status || null,
    totalPages,
    totalChunks,
    totalEmbeddings: chunksWithEmbeddings,
  }
}
