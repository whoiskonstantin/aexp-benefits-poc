import { NextRequest, NextResponse } from 'next/server'
import { reindexContent, getReindexStatus } from '@/lib/indexer'

/**
 * POST /api/admin/reindex
 * Trigger content re-indexing
 */
export async function POST(request: NextRequest) {
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

    // Run reindex
    const result = await reindexContent()

    return NextResponse.json(
      {
        status: 'success',
        data: {
          jobId: `reindex-${Date.now()}`,
          startedAt: new Date().toISOString(),
          pagesDiscovered: result.pagesIndexed,
          pagesCrawled: result.pagesIndexed,
          pagesFailed: 0,
          chunksCreated: result.chunksCreated,
          embeddingsGenerated: result.embeddingsGenerated,
          duration: result.duration,
          status: 'success',
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Reindex error:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: 'REINDEX_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error during reindexing',
      },
      { status: 500 }
    )
  }
}
