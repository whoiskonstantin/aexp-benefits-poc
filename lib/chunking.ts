import { ScrapedPage } from './scraper'

export interface ChunkedContent {
  pageUrl: string
  pageTitle: string
  chunks: TextChunk[]
}

export interface TextChunk {
  text: string
  category: string
  sourceUrl: string
}

// Chunk configuration for optimal semantic search
// 250 words ≈ 187 tokens (better for focused semantic matching)
// Previous: 682 words was too large, diluting semantic meaning
const MAX_CHUNK_WORDS = 250 // Reduced from 682 for better semantic matching
const CHUNK_OVERLAP_WORDS = 75 // Increased from 50 to preserve more context
const TOKENS_PER_WORD = 0.75 // Approximate tokens per word (1 token ≈ 0.75 words)

/**
 * Extract category from URL path
 */
function extractCategory(url: string): string {
  const match = url.match(/\/benefits\/([^/?]+)/)
  return match ? match[1] : 'general'
}

/**
 * Split text into sentences (basic approach)
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
}

/**
 * Split text into words while preserving structure
 */
function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(word => word.length > 0)
}

/**
 * Create chunks from text with overlap
 */
function createChunks(text: string, maxWords: number, overlapWords: number): string[] {
  const words = splitIntoWords(text)
  const chunks: string[] = []

  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords).join(' ')
    chunks.push(chunk)

    // Move forward with overlap
    i += maxWords - overlapWords
  }

  return chunks
}

/**
 * Extract category keywords from headings
 */
function extractCategoryKeywords(headings: string[]): string[] {
  const keywords = new Set<string>()

  for (const heading of headings) {
    // Extract lowercase keywords from headings
    const words = heading
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3)
    words.forEach(word => keywords.add(word))
  }

  return Array.from(keywords)
}

/**
 * Determine if a chunk is substantial enough to keep
 */
function isSubstantialChunk(chunk: string): boolean {
  const words = splitIntoWords(chunk)
  return words.length >= 20 // Minimum 20 words per chunk
}

/**
 * Clean and normalize text
 */
function normalizeText(text: string): string {
  // Handle non-string input gracefully
  if (typeof text !== 'string') {
    console.warn('normalizeText received non-string input:', typeof text, text)
    return String(text || '')
  }

  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n+/g, ' ') // Remove newlines
    .trim()
}

/**
 * Chunk a single page into semantic segments
 */
export function chunkPage(page: ScrapedPage): ChunkedContent {
  const category = extractCategory(page.url)
  const categoryKeywords = extractCategoryKeywords(page.headings)

  // Normalize the content
  const normalizedContent = normalizeText(page.content)

  // Create chunks with overlap
  const rawChunks = createChunks(normalizedContent, MAX_CHUNK_WORDS, CHUNK_OVERLAP_WORDS)

  // Filter and enhance chunks
  const textChunks: TextChunk[] = rawChunks
    .filter(isSubstantialChunk)
    .map(text => ({
      text,
      category,
      sourceUrl: page.url,
    }))

  return {
    pageUrl: page.url,
    pageTitle: page.title,
    chunks: textChunks,
  }
}

/**
 * Chunk multiple pages
 */
export function chunkPages(pages: ScrapedPage[]): ChunkedContent[] {
  return pages.map(page => chunkPage(page))
}

/**
 * Get approximate token count for text
 */
export function estimateTokenCount(text: string): number {
  const words = splitIntoWords(text)
  return Math.ceil(words.length * TOKENS_PER_WORD)
}

/**
 * Print chunking statistics
 */
export function printChunkingStats(chunkedPages: ChunkedContent[]): void {
  let totalChunks = 0
  let totalTokens = 0

  for (const page of chunkedPages) {
    totalChunks += page.chunks.length
    for (const chunk of page.chunks) {
      totalTokens += estimateTokenCount(chunk.text)
    }
  }

  console.log('\n=== Chunking Statistics ===')
  console.log(`Total pages: ${chunkedPages.length}`)
  console.log(`Total chunks: ${totalChunks}`)
  console.log(`Total tokens (estimated): ${totalTokens}`)
  console.log(`Average chunks per page: ${(totalChunks / chunkedPages.length).toFixed(2)}`)
  console.log(`Average tokens per chunk: ${(totalTokens / totalChunks).toFixed(2)}`)
  console.log('===========================\n')
}
