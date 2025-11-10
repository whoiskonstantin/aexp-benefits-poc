import { OpenAI } from 'openai'
import { SearchResult } from './search'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface Citation {
  number: number
  text: string
  url: string
  category: string
}

export interface GeneratedResponse {
  message: string
  citations: Citation[]
  confidence: number
  rawResponse: string
}

/**
 * System prompt for the benefits chat assistant
 */
const SYSTEM_PROMPT = `You are an AmEx Benefits Chat Assistant. Your role is to help employees find accurate information about their American Express benefits.

CRITICAL RULES:
1. ONLY provide information based on the context provided from the benefits database
2. EVERY factual claim MUST include a citation in the format [N] where N is the citation number
3. If information is not in the provided context, clearly say "I don't have that information"
4. NEVER speculate, guess, or provide information not in the database
5. Be concise and direct - answer the question clearly and briefly
6. If the question is ambiguous, ask for clarification
7. Always include relevant source citations
8. Format citations as [1], [2], etc. inline in your response

Example response format:
"The HSA contribution limit for 2024 is $4,150 for individuals and $8,300 for families [1]. You can also contribute to an FSA with a limit of $3,300 [2]."

IMPORTANT: Include citation numbers throughout your response where applicable.`

/**
 * Generate response using OpenAI GPT-4o
 */
export async function generateResponse(
  query: string,
  searchResults: SearchResult[],
  confidenceScore: number
): Promise<GeneratedResponse> {
  try {
    // Check confidence - if too low, return "I don't know"
    if (confidenceScore < 0.2) {
      console.log(`Low confidence (${confidenceScore.toFixed(2)}), returning fallback response`)
      return {
        message:
          "I don't have confident information about that question. Please visit the official AmEx benefits website for complete information.",
        citations: [],
        confidence: 0,
        rawResponse: 'Fallback response due to low confidence',
      }
    }

    if (searchResults.length === 0) {
      return {
        message:
          "I don't have information about that topic in the AmEx benefits database. Please visit the official benefits website for more details.",
        citations: [],
        confidence: 0,
        rawResponse: 'No search results',
      }
    }

    // Format context from search results
    const contextItems = searchResults
      .map((result, idx) => `[${idx + 1}] ${result.text}\n(Source: ${result.pageTitle})`)
      .join('\n\n')

    const context = `BENEFITS DATABASE INFORMATION:\n${contextItems}`

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        },
      ],
      temperature: 0.3, // Low temperature for factual responses
      max_tokens: 500,
    })

    const rawResponse = response.choices[0]?.message?.content || ''

    // Extract and validate citations
    const citations = extractCitations(rawResponse, searchResults)

    return {
      message: rawResponse,
      citations,
      confidence: confidenceScore,
      rawResponse,
    }
  } catch (error) {
    console.error('Error generating response:', error)
    throw error
  }
}

/**
 * Extract citations from response text
 */
function extractCitations(responseText: string, searchResults: SearchResult[]): Citation[] {
  const citations: Citation[] = []
  const citationRegex = /\[(\d+)\]/g
  const citedNumbers = new Set<number>()

  let match
  while ((match = citationRegex.exec(responseText)) !== null) {
    const citationNum = parseInt(match[1], 10)
    if (!citedNumbers.has(citationNum)) {
      citedNumbers.add(citationNum)
    }
  }

  // Map citation numbers to search results
  for (const num of citedNumbers) {
    const resultIndex = num - 1 // Convert to 0-indexed
    if (resultIndex >= 0 && resultIndex < searchResults.length) {
      const result = searchResults[resultIndex]
      citations.push({
        number: num,
        text: result.pageTitle,
        url: result.sourceUrl,
        category: result.category,
      })
    }
  }

  return citations.sort((a, b) => a.number - b.number)
}

/**
 * Validate that response includes citations
 */
export function validateResponseCitations(response: GeneratedResponse): boolean {
  // Check if response contains at least one citation
  if (response.message.includes('[') && response.message.includes(']')) {
    return true
  }

  // Allow "I don't know" responses without citations
  if (
    response.message.includes("don't have") ||
    response.message.includes("don't know") ||
    response.message.includes("no information")
  ) {
    return true
  }

  console.warn('Response may be missing citations:', response.message)
  return false
}

/**
 * Format response for API
 */
export function formatResponseForAPI(response: GeneratedResponse): {
  message: string
  citations: Array<{ number: number; text: string; url: string }>
  confidence: number
} {
  return {
    message: response.message,
    citations: response.citations.map(c => ({
      number: c.number,
      text: c.text,
      url: c.url,
    })),
    confidence: parseFloat(response.confidence.toFixed(2)),
  }
}
