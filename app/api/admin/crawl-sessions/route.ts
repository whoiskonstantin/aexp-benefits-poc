import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/crawl-sessions
 * Fetch all crawl sessions
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

    // Fetch all crawl sessions (most recent first)
    const sessions = await prisma.crawlSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50, // Limit to last 50 sessions
      include: {
        _count: {
          select: { navigationSteps: true },
        },
      },
    })

    return NextResponse.json(
      {
        status: 'success',
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt?.toISOString() || null,
            status: session.status,
            pagesScraped: session.pagesScraped,
            navigationStepsCount: session._count.navigationSteps,
            duration: session.completedAt
              ? session.completedAt.getTime() - session.startedAt.getTime()
              : null,
          })),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching crawl sessions:', error)

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
