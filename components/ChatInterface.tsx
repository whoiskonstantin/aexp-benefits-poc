'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ number: number; text: string; url: string }>
  confidence?: number
  timestamp: Date
}

interface ApiResponse {
  status: string
  data?: {
    message: string
    citations: Array<{ number: number; text: string; url: string }>
    confidence: number
  }
  error?: string
  message?: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputValue.trim()) {
      return
    }

    // Clear error
    setError(null)

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Send to API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
        }),
      })

      const data: ApiResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to get response')
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data?.message || 'No response',
        citations: data.data?.citations || [],
        confidence: data.data?.confidence,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      console.error('Chat error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearConversation = () => {
    setMessages([])
    setError(null)
    setInputValue('')
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold">AmEx Benefits Chat</h1>
        <p className="text-blue-100 mt-1">Ask questions about your American Express benefits</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
              <p className="text-gray-600 mb-4">
                Ask me anything about your AmEx benefits like medical plans, retirement, HSA/FSA, dental, or vision coverage.
              </p>
              <p className="text-sm text-gray-500">Example: "What is the HSA contribution limit?"</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(message => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white border border-gray-300 text-gray-900 rounded-bl-none'
                  }`}
                >
                  {/* Message content */}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>

                  {/* Citations */}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-semibold mb-2 text-gray-600">Sources:</p>
                      <div className="space-y-1">
                        {message.citations.map(citation => (
                          <a
                            key={citation.number}
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:text-blue-700 block hover:underline"
                          >
                            [{citation.number}] {citation.text}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {message.confidence !== undefined && (
                    <div className="mt-2 text-xs text-gray-500">
                      Confidence: {(message.confidence * 100).toFixed(0)}%
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-300 text-gray-900 p-4 rounded-lg rounded-bl-none">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                <p className="font-semibold">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-6 shadow-lg">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Ask a question about your benefits..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </form>

        {messages.length > 0 && (
          <button
            onClick={handleClearConversation}
            className="mt-3 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear conversation
          </button>
        )}
      </div>
    </div>
  )
}
