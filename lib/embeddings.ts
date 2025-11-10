import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// OpenAI embedding model to use
const EMBEDDING_MODEL = 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = 1536

/**
 * Generate embeddings for a batch of texts
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    throw new Error('No texts provided for embedding')
  }

  try {
    console.log(`Generating embeddings for ${texts.length} text(s)...`)

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    })

    // Extract embeddings and ensure they're in order
    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding)

    console.log(`Successfully generated ${embeddings.length} embeddings`)
    return embeddings
  } catch (error) {
    console.error('Error generating embeddings:', error)
    throw error
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text])
  return embeddings[0]
}

/**
 * Generate embeddings for texts in batches to avoid token limits
 */
export async function generateEmbeddingsBatched(
  texts: string[],
  batchSize: number = 50
): Promise<number[][]> {
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`
    )

    const embeddings = await generateEmbeddings(batch)
    allEmbeddings.push(...embeddings)

    // Add delay between batches to respect API rate limits
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return allEmbeddings
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension')
  }

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * Convert embedding array to JSON string for storage
 */
export function embeddingToString(embedding: number[]): string {
  return JSON.stringify(embedding)
}

/**
 * Convert stored JSON string back to embedding array
 */
export function stringToEmbedding(embeddingStr: string): number[] {
  try {
    return JSON.parse(embeddingStr)
  } catch (error) {
    console.error('Error parsing embedding string:', error)
    return []
  }
}

/**
 * Verify embedding dimensions are correct
 */
export function validateEmbedding(embedding: number[]): boolean {
  if (!Array.isArray(embedding)) {
    return false
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    console.warn(
      `Embedding has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`
    )
    return false
  }

  return embedding.every(val => typeof val === 'number' && isFinite(val))
}
