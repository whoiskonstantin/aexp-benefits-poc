import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/navigation/[sessionId]
 * Fetch navigation steps for a specific crawl session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
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

    const { sessionId } = await params
    const sessionIdNum = parseInt(sessionId, 10)

    if (isNaN(sessionIdNum)) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'INVALID_SESSION_ID',
          message: 'Session ID must be a number',
        },
        { status: 400 }
      )
    }

    // Fetch crawl session with navigation steps
    const session = await prisma.crawlSession.findUnique({
      where: { id: sessionIdNum },
      include: {
        navigationSteps: {
          orderBy: { visitedAt: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        {
          status: 'error',
          error: 'SESSION_NOT_FOUND',
          message: `Crawl session ${sessionId} not found`,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        status: 'success',
        data: {
          session: {
            id: session.id,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt?.toISOString() || null,
            status: session.status,
            pagesScraped: session.pagesScraped,
          },
          navigationSteps: session.navigationSteps.map(step => ({
            id: step.id,
            url: step.url,
            depth: step.depth,
            parentUrl: step.parentUrl,
            linkText: step.linkText,
            visitedAt: step.visitedAt.toISOString(),
            scraped: step.scraped,
          })),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching navigation history:', error)

    return NextResponse.json(
      {
        status: 'error',
        error: 'FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
