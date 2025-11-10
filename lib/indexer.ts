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
}> {
  const startTime = Date.now()

  try {
    console.log('\n========================================')
    console.log('Starting content reindexing...')
    console.log('========================================\n')

    // Step 1: Crawl benefits pages
    console.log('Step 1: Crawling benefits pages...')
    const scrapedPages = await crawlBenefitsPages()
    console.log(`✓ Crawled ${scrapedPages.length} pages\n`)

    if (scrapedPages.length === 0) {
      console.warn('No pages crawled. Aborting reindex.')
      return {
        pagesIndexed: 0,
        chunksCreated: 0,
        embeddingsGenerated: 0,
        duration: 0,
      }
    }

    // Step 2: Chunk content
    console.log('Step 2: Chunking content...')
    const chunkedPages = chunkPages(scrapedPages)
    printChunkingStats(chunkedPages)

    // Step 3: Clear old data
    console.log('Step 3: Clearing old data from database...')
    const deletedChunks = await prisma.chunk.deleteMany({})
    const deletedPages = await prisma.page.deleteMany({})
    console.log(`✓ Deleted ${deletedChunks.count} chunks and ${deletedPages.count} pages\n`)

    // Step 4: Store pages and chunks
    console.log('Step 4: Storing pages in database...')
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

    // Step 5: Generate embeddings for all chunks
    console.log('Step 5: Generating embeddings...')
    const allChunks = chunkedPages.flatMap(p => p.chunks)
    const allChunkTexts = allChunks.map(chunk => chunk.text)

    const embeddings = await generateEmbeddingsBatched(allChunkTexts, 50)
    console.log(`✓ Generated ${embeddings.length} embeddings\n`)

    // Step 6: Store chunks with embeddings
    console.log('Step 6: Storing chunks with embeddings...')
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

    // Step 7: Log the reindex action
    await prisma.adminLog.create({
      data: {
        action: 'reindex',
        status: 'success',
        message: `Indexed ${scrapedPages.length} pages into ${chunksStored} chunks with embeddings`,
        metadata: {
          pagesIndexed: scrapedPages.length,
          chunksCreated: chunksStored,
          embeddingsGenerated: embeddings.length,
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
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s\n`)

    return {
      pagesIndexed: scrapedPages.length,
      chunksCreated: chunksStored,
      embeddingsGenerated: embeddings.length,
      duration,
    }
  } catch (error) {
    console.error('Error during reindexing:', error)

    // Log the error
    await prisma.adminLog.create({
      data: {
        action: 'reindex',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
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
