'use client'

import { useState, useEffect } from 'react'

interface CrawlSession {
  id: number
  startedAt: string
  completedAt: string | null
  status: string
  pagesScraped: number
  navigationStepsCount: number
  duration: number | null
}

interface NavigationStep {
  id: number
  url: string
  depth: number
  parentUrl: string | null
  linkText: string | null
  visitedAt: string
  scraped: boolean
}

interface ReindexResult {
  jobId: string
  startedAt: string
  pagesDiscovered: number
  pagesCrawled: number
  chunksCreated: number
  embeddingsGenerated: number
  duration: number
  crawlSessionId: number
  navigationSteps: number
  status: string
}

export default function AdminPage() {
  const [adminToken, setAdminToken] = useState<string>('')
  const [tokenInput, setTokenInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [lastReindexResult, setLastReindexResult] = useState<ReindexResult | null>(null)
  const [crawlSessions, setCrawlSessions] = useState<CrawlSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([])

  // Load admin token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken')
    if (storedToken) {
      setAdminToken(storedToken)
    }
  }, [])

  // Fetch crawl sessions when token is set
  useEffect(() => {
    if (adminToken) {
      fetchCrawlSessions()
    }
  }, [adminToken])

  // Fetch navigation steps when a session is selected
  useEffect(() => {
    if (selectedSessionId && adminToken) {
      fetchNavigationSteps(selectedSessionId)
    }
  }, [selectedSessionId, adminToken])

  const saveToken = () => {
    if (tokenInput.trim()) {
      localStorage.setItem('adminToken', tokenInput.trim())
      setAdminToken(tokenInput.trim())
      setTokenInput('')
      setError('')
    }
  }

  const clearToken = () => {
    localStorage.removeItem('adminToken')
    setAdminToken('')
    setError('')
  }

  const fetchCrawlSessions = async () => {
    try {
      const response = await fetch('/api/admin/crawl-sessions', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      const data = await response.json()

      if (data.status === 'success') {
        setCrawlSessions(data.data.sessions)
        // Auto-select the most recent session
        if (data.data.sessions.length > 0 && !selectedSessionId) {
          setSelectedSessionId(data.data.sessions[0].id)
        }
      } else {
        setError(data.message || 'Failed to fetch crawl sessions')
      }
    } catch (err) {
      console.error('Error fetching crawl sessions:', err)
    }
  }

  const fetchNavigationSteps = async (sessionId: number) => {
    try {
      const response = await fetch(`/api/admin/navigation/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      const data = await response.json()

      if (data.status === 'success') {
        setNavigationSteps(data.data.navigationSteps)
      } else {
        setError(data.message || 'Failed to fetch navigation steps')
      }
    } catch (err) {
      console.error('Error fetching navigation steps:', err)
    }
  }

  const triggerReindex = async () => {
    if (!adminToken) {
      setError('Please set admin token first')
      return
    }

    setIsLoading(true)
    setError('')
    setLastReindexResult(null)

    try {
      const response = await fetch('/api/admin/reindex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      })

      const data = await response.json()

      if (data.status === 'success') {
        setLastReindexResult(data.data)
        // Refresh crawl sessions
        await fetchCrawlSessions()
        // Auto-select the new session
        setSelectedSessionId(data.data.crawlSessionId)
      } else {
        setError(data.message || 'Reindex failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Admin Authentication</h1>
          <p className="text-gray-600 mb-4">
            Please enter your admin token. You can also set it via console:
          </p>
          <code className="block bg-gray-100 p-2 rounded text-sm mb-4">
            localStorage.setItem('adminToken', 'your-token')
          </code>
          <div className="space-y-4">
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && saveToken()}
              placeholder="Enter admin token"
              className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveToken}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Save Token
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <button
              onClick={clearToken}
              className="bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition"
            >
              Clear Token
            </button>
          </div>
        </div>

        {/* Reindex Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Reindex Content</h2>
          <p className="text-gray-600 mb-4">
            Trigger a crawl of the AmEx benefits site. This will scrape pages using Playwright + GPT-4o-mini
            and save navigation steps to the database.
          </p>
          <button
            onClick={triggerReindex}
            disabled={isLoading}
            className={`${
              isLoading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
            } text-white py-2 px-6 rounded transition font-semibold`}
          >
            {isLoading ? 'Reindexing...' : 'Start Reindex'}
          </button>

          {error && (
            <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {lastReindexResult && (
            <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <h3 className="font-bold mb-2">Reindex Complete!</h3>
              <div className="text-sm space-y-1">
                <p>Pages Crawled: {lastReindexResult.pagesCrawled}</p>
                <p>Chunks Created: {lastReindexResult.chunksCreated}</p>
                <p>Embeddings Generated: {lastReindexResult.embeddingsGenerated}</p>
                <p>Navigation Steps: {lastReindexResult.navigationSteps}</p>
                <p>Duration: {formatDuration(lastReindexResult.duration)}</p>
                <p>Crawl Session ID: {lastReindexResult.crawlSessionId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Crawl Sessions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Crawl History</h2>
          {crawlSessions.length === 0 ? (
            <p className="text-gray-600">No crawl sessions yet. Trigger a reindex to get started!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4">ID</th>
                    <th className="text-left py-2 px-4">Started</th>
                    <th className="text-left py-2 px-4">Status</th>
                    <th className="text-left py-2 px-4">Pages</th>
                    <th className="text-left py-2 px-4">Nav Steps</th>
                    <th className="text-left py-2 px-4">Duration</th>
                    <th className="text-left py-2 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crawlSessions.map((session) => (
                    <tr
                      key={session.id}
                      className={`border-b hover:bg-gray-50 ${
                        selectedSessionId === session.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="py-2 px-4">#{session.id}</td>
                      <td className="py-2 px-4 text-sm">{formatDate(session.startedAt)}</td>
                      <td className="py-2 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            session.status === 'completed'
                              ? 'bg-green-200 text-green-800'
                              : session.status === 'failed'
                              ? 'bg-red-200 text-red-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="py-2 px-4">{session.pagesScraped}</td>
                      <td className="py-2 px-4">{session.navigationStepsCount}</td>
                      <td className="py-2 px-4">{formatDuration(session.duration)}</td>
                      <td className="py-2 px-4">
                        <button
                          onClick={() => setSelectedSessionId(session.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                        >
                          View Steps
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Navigation Steps */}
        {selectedSessionId && navigationSteps.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">
              Navigation Steps - Session #{selectedSessionId}
            </h2>
            <div className="space-y-2">
              {navigationSteps.map((step, index) => (
                <div
                  key={step.id}
                  className={`border rounded p-3 ${
                    step.scraped ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-500">
                          Step {index + 1} • Depth {step.depth}
                        </span>
                        {step.scraped && (
                          <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded">
                            Scraped
                          </span>
                        )}
                      </div>
                      <div className="text-sm">
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline break-all"
                        >
                          {step.url}
                        </a>
                      </div>
                      {step.linkText && (
                        <div className="text-xs text-gray-600 mt-1">
                          Link text: "{step.linkText}"
                        </div>
                      )}
                      {step.parentUrl && (
                        <div className="text-xs text-gray-500 mt-1">
                          From: {step.parentUrl}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 ml-4">
                      {formatDate(step.visitedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
