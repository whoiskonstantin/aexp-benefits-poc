import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { searchChunks, calculateAverageSearchSimilarity } from '@/lib/search'
import { generateResponse, formatResponseForAPI, validateResponseCitations } from '@/lib/response-generator'
import prisma from '@/lib/prisma'

// Request validation schema
const ChatRequestSchema = z.object({
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message exceeds maximum length'),
})

/**
 * POST /api/chat
 * Submit a question and receive an answer with citations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validation = ChatRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'INVALID_INPUT',
          message: validation.error.issues[0]?.message || 'Invalid request',
        },
        { status: 400 }
      )
    }

    const { message } = validation.data

    console.log(`Chat request: ${message}`)

    // Step 1: Search for relevant chunks
    const searchResults = await searchChunks(message, 5)

    // Step 2: Calculate confidence based on search results
    const confidence = calculateAverageSearchSimilarity(searchResults)

    // Step 3: Generate response using LLM
    const response = await generateResponse(message, searchResults, confidence)

    // Step 4: Validate response quality
    if (!validateResponseCitations(response)) {
      console.warn('Response may be missing proper citations')
    }

    // Step 5: Log the interaction
    await prisma.adminLog.create({
      data: {
        action: 'chat',
        status: 'success',
        message: `Chat query: "${message.substring(0, 100)}"`,
        metadata: {
          queryLength: message.length,
          resultsFound: searchResults.length,
          confidence: confidence,
          citationsCount: response.citations.length,
        },
      },
    })

    // Step 6: Return formatted response
    return NextResponse.json(
      {
        status: 'success',
        data: formatResponseForAPI(response),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Chat error:', error)

    // Log error
    try {
      await prisma.adminLog.create({
        data: {
          action: 'chat',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            error: error instanceof Error ? error.stack : String(error),
          },
        },
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return NextResponse.json(
      {
        status: 'error',
        error: 'CHAT_ERROR',
        message: 'An error occurred while processing your request. Please try again.',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chat
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      message: 'Chat API is running. Use POST /api/chat to send messages.',
    },
    { status: 200 }
  )
}
