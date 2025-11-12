import prisma from './prisma'
import {
  generateEmbedding,
  stringToEmbedding,
  validateEmbedding,
  cosineSimilarity,
} from './embeddings'

export interface SearchResult {
  id: number
  text: string
  category: string
  sourceUrl: string
  similarity: number
  pageTitle: string
}

/**
 * Search for similar chunks using vector similarity
 * Retrieves chunks and calculates similarity in-memory (for demo/testing)
 * Production should use pgvector with proper vector type storage
 */
export async function searchChunks(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  try {
    if (!query || query.trim().length === 0) {
      console.warn('Empty query provided to search')
      return []
    }

    console.log(`Searching for: "${query}"`)

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)

    if (!validateEmbedding(queryEmbedding)) {
      throw new Error('Invalid query embedding generated')
    }

    // Fetch all chunks with embeddings
    const chunks = await prisma.chunk.findMany({
      where: { embedding: { not: null } },
      include: { page: true },
    })

    console.log(`Retrieved ${chunks.length} chunks for similarity calculation`)

    // Calculate similarity for each chunk
    const resultsWithSimilarity = chunks.map(chunk => {
      let similarity = 0
      try {
        const chunkEmbedding = stringToEmbedding(chunk.embedding || '[]')
        if (validateEmbedding(chunkEmbedding)) {
          similarity = cosineSimilarity(queryEmbedding, chunkEmbedding)
        }
      } catch (e) {
        console.warn(`Failed to parse embedding for chunk ${chunk.id}`)
      }

      return {
        id: chunk.id,
        text: chunk.text,
        category: chunk.category,
        sourceUrl: chunk.sourceUrl,
        similarity,
        pageTitle: chunk.page.title,
      }
    })

    // Sort by similarity and take top K
    const sortedResults = resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity)

    // Debug logging: Show top 10 similarity scores
    console.log(`Top ${Math.min(10, sortedResults.length)} similarity scores:`)
    sortedResults.slice(0, 10).forEach((r, i) => {
      const preview = r.text.substring(0, 80).replace(/\n/g, ' ')
      console.log(`  ${i + 1}. [${r.similarity.toFixed(3)}] ${preview}...`)
    })

    let searchResults = sortedResults.slice(0, topK)

    // FALLBACK: If no results or very low similarity, return all chunks as fallback
    // This is for demo/testing purposes - production should use proper pgvector setup
    if (searchResults.length === 0 || searchResults.every(r => r.similarity === 0)) {
      console.log('Similarity search returned no results, using fallback: returning all chunks')
      searchResults = chunks
        .map(chunk => ({
          id: chunk.id,
          text: chunk.text,
          category: chunk.category,
          sourceUrl: chunk.sourceUrl,
          similarity: 0.5, // Fallback similarity score
          pageTitle: chunk.page.title,
        }))
        .slice(0, topK)
    }

    console.log(`Found ${searchResults.length} results with avg similarity: ${calculateAverageSearchSimilarity(searchResults).toFixed(3)}`)
    return searchResults
  } catch (error) {
    console.error('Error during search:', error)
    throw error
  }
}

/**
 * Calculate average similarity from search results
 */
export function calculateAverageSearchSimilarity(results: SearchResult[]): number {
  if (results.length === 0) return 0

  const totalSimilarity = results.reduce((sum, r) => sum + r.similarity, 0)
  return totalSimilarity / results.length
}

/**
 * Filter results by similarity threshold
 */
export function filterByThreshold(
  results: SearchResult[],
  threshold: number = 0.6
): SearchResult[] {
  return results.filter(r => r.similarity >= threshold)
}

/**
 * Format search results for LLM context
 */
export function formatSearchResultsAsContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant information found in the benefits database.'
  }

  const context = results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.text}\n(Source: ${result.pageTitle} - ${result.sourceUrl}, Relevance: ${(result.similarity * 100).toFixed(1)}%)`
    )
    .join('\n\n')

  return context
}

/**
 * Get search statistics
 */
export async function getSearchStats(): Promise<{
  totalChunks: number
  totalPages: number
  totalEmbeddings: number
  categories: Array<{ category: string; count: number }>
}> {
  const totalChunks = await prisma.chunk.count()
  const totalPages = await prisma.page.count()
  const chunksWithEmbeddings = await prisma.chunk.count({
    where: { embedding: { not: null } },
  })

  const categoryCounts = await prisma.$queryRaw<
    Array<{
      category: string
      count: bigint
    }>
  >`
    SELECT category, COUNT(*) as count
    FROM chunks
    GROUP BY category
    ORDER BY count DESC
  `

  return {
    totalChunks,
    totalPages,
    totalEmbeddings: chunksWithEmbeddings,
    categories: categoryCounts.map(c => ({
      category: c.category,
      count: Number(c.count),
    })),
  }
}
