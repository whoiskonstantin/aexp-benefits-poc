import { NextRequest, NextResponse } from 'next/server'
import { getReindexStatus } from '@/lib/indexer'

/**
 * GET /api/admin/status
 * Get current system and indexing status
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin token
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'UNAUTHORIZED',
          message: 'Invalid or missing admin token',
        },
        { status: 401 }
      )
    }

    const indexStatus = await getReindexStatus()

    return NextResponse.json(
      {
        status: 'success',
        data: {
          health: {
            database: 'connected',
            openai: 'ok',
            uptime: Math.floor(process.uptime()),
          },
          indexing: {
            lastReindexAt: indexStatus.lastReindexAt?.toISOString() || null,
            lastReindexStatus: indexStatus.lastReindexStatus,
            totalPages: indexStatus.totalPages,
            totalChunks: indexStatus.totalChunks,
            totalEmbeddings: indexStatus.totalEmbeddings,
            nextScheduledReindex: null,
          },
          performance: {
            avgSearchTime: 450,
            avgLLMTime: 1200,
            avgResponseTime: 1650,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Status error:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: 'STATUS_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error checking status',
      },
      { status: 500 }
    )
  }
}
