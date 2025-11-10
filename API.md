# API.md

Complete API endpoint documentation for the AmEx Benefits Chat application.

## API Overview

The application exposes three main API endpoints:

1. **POST /api/chat** - Submit a question and receive an answer with citations
2. **POST /api/admin/reindex** - Trigger content re-indexing (admin only)
3. **GET /api/admin/status** - Get system status and indexing information (admin only)

All endpoints return JSON responses. Errors include appropriate HTTP status codes and error messages.

---

## Endpoint: POST /api/chat

Submit a user question and receive a response with citations.

### Request

**URL**: `POST /api/chat`

**Content-Type**: `application/json`

**Headers**:
```
Content-Type: application/json
```

**Body Schema**:
```typescript
{
  message: string  // User question (1-2000 characters)
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the HSA contribution limit for 2024?"
  }'
```

### Response

**Success Response (200 OK)**:
```typescript
{
  status: "success",
  data: {
    message: string,        // Answer text with citations [1], [2], etc.
    citations: Citation[],  // Array of sources
    confidence: number      // 0-1, relevance score
  }
}
```

**Citation Schema**:
```typescript
interface Citation {
  number: number              // Citation number [1], [2], etc.
  text: string                // Citation text (e.g., "Source: Medical Plans")
  url: string                 // Full URL to source page
  category: string            // Topic category (e.g., "medical", "retirement")
}
```

**Example Success Response**:
```json
{
  "status": "success",
  "data": {
    "message": "The 2024 HSA contribution limit is $4,150 for individuals and $8,300 for families [1]. You can also contribute to an FSA with a limit of $3,300 [2].",
    "citations": [
      {
        "number": 1,
        "text": "HSA Contribution Limits",
        "url": "https://www.aexp.com/benefits/retirement#hsa-2024",
        "category": "retirement"
      },
      {
        "number": 2,
        "text": "FSA Contribution Limits",
        "url": "https://www.aexp.com/benefits/retirement#fsa-2024",
        "category": "retirement"
      }
    ],
    "confidence": 0.92
  }
}
```

### Error Responses

**400 Bad Request - Invalid input**:
```json
{
  "status": "error",
  "error": "INVALID_INPUT",
  "message": "Message must be between 1 and 2000 characters"
}
```

**429 Too Many Requests - Rate limit exceeded**:
```json
{
  "status": "error",
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Maximum 10 requests per minute per IP.",
  "retryAfter": 45
}
```

**500 Internal Server Error - Server error**:
```json
{
  "status": "error",
  "error": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred. Please try again later."
}
```

**503 Service Unavailable - Dependency error**:
```json
{
  "status": "error",
  "error": "SERVICE_UNAVAILABLE",
  "message": "Chat service temporarily unavailable. Please try again later.",
  "retryAfter": 60
}
```

### Request Validation

- **message** (required): 1-2000 characters, non-empty
- **rate limiting**: 10 requests per minute per IP address

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `INVALID_INPUT` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SEARCH_FAILED` | 500 | Search engine error |
| `LLM_ERROR` | 503 | OpenAI API error |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

### Implementation Notes

- Response time target: <3 seconds
- Confidence score calculated from average embedding similarity distance
- If confidence <0.6, response will be "I don't know" instead of attempt
- All external API calls have 30-second timeout
- Request/response logged for analytics

---

## Endpoint: POST /api/admin/reindex

Trigger content re-indexing (crawl, chunk, and embed all benefits pages).

### Request

**URL**: `POST /api/admin/reindex`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <admin-token>
```

**Body** (optional):
```typescript
{
  force?: boolean  // Force re-index even if recent (default: false)
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-admin-token" \
  -d '{ "force": true }'
```

### Response

**Success Response (200 OK)**:
```typescript
{
  status: "success",
  data: {
    jobId: string,              // Unique re-index job ID
    startedAt: string,          // ISO timestamp
    pagesDiscovered: number,    // Total pages found
    pagesCrawled: number,       // Pages successfully crawled
    pagesFaile: number,        // Pages that failed
    chunksCreated: number,      // Total chunks created
    embeddingsGenerated: number,// Total embeddings generated
    duration: number,           // Milliseconds taken
    status: "success" | "completed_with_errors"
  }
}
```

**Example Success Response**:
```json
{
  "status": "success",
  "data": {
    "jobId": "reindex-2024-01-15-13-45-22",
    "startedAt": "2024-01-15T13:45:22Z",
    "pagesDiscovered": 45,
    "pagesCrawled": 45,
    "pagesFailed": 0,
    "chunksCreated": 512,
    "embeddingsGenerated": 512,
    "duration": 45000,
    "status": "success"
  }
}
```

### Error Responses

**401 Unauthorized - Invalid token**:
```json
{
  "status": "error",
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing admin token"
}
```

**409 Conflict - Re-index already in progress**:
```json
{
  "status": "error",
  "error": "REINDEX_IN_PROGRESS",
  "message": "Another re-index is already running. Job ID: reindex-2024-01-15-13-40-00"
}
```

**500 Internal Server Error**:
```json
{
  "status": "error",
  "error": "REINDEX_FAILED",
  "message": "Re-indexing failed after 3 retries. See logs for details."
}
```

### Request Validation

- **Authorization header** (required): Valid admin token
- **force** (optional): Boolean, defaults to false

### Implementation Notes

- Re-indexing is synchronous (waits for completion)
- Response time: 30-120 seconds depending on site size
- Re-indexing locks database to prevent conflicts
- Previous embeddings are cleared before re-indexing
- Progress logged to admin_logs table
- Returns 409 if another re-index is in progress

---

## Endpoint: GET /api/admin/status

Get current system status and indexing information.

### Request

**URL**: `GET /api/admin/status`

**Headers**:
```
Authorization: Bearer <admin-token>
```

**Query Parameters**: None

**Example Request**:
```bash
curl -X GET http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer your-secret-admin-token"
```

### Response

**Success Response (200 OK)**:
```typescript
{
  status: "success",
  data: {
    health: {
      database: "connected" | "error",
      openai: "ok" | "error",
      uptime: number  // Seconds
    },
    indexing: {
      lastReindexAt: string,          // ISO timestamp
      lastReindexStatus: "success" | "failed" | "pending",
      totalPages: number,             // Total pages in database
      totalChunks: number,            // Total chunks in database
      totalEmbeddings: number,        // Total embeddings stored
      nextScheduledReindex: string?   // ISO timestamp if scheduled
    },
    performance: {
      avgSearchTime: number,  // Average search query time (ms)
      avgLLMTime: number,     // Average LLM response time (ms)
      avgResponseTime: number // Average total response time (ms)
    }
  }
}
```

**Example Success Response**:
```json
{
  "status": "success",
  "data": {
    "health": {
      "database": "connected",
      "openai": "ok",
      "uptime": 86400
    },
    "indexing": {
      "lastReindexAt": "2024-01-15T12:00:00Z",
      "lastReindexStatus": "success",
      "totalPages": 45,
      "totalChunks": 512,
      "totalEmbeddings": 512,
      "nextScheduledReindex": null
    },
    "performance": {
      "avgSearchTime": 450,
      "avgLLMTime": 1200,
      "avgResponseTime": 1650
    }
  }
}
```

### Error Responses

**401 Unauthorized**:
```json
{
  "status": "error",
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing admin token"
}
```

**503 Service Unavailable - Database error**:
```json
{
  "status": "error",
  "error": "SERVICE_UNAVAILABLE",
  "message": "Cannot connect to database. Status unknown."
}
```

### Implementation Notes

- Cached for 1 minute to avoid expensive queries
- Performance metrics calculated from last 1000 requests
- Used for monitoring and alerting

---

## Request/Response Examples

### Example 1: Simple Chat Query

```bash
# Request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "When is open enrollment?"}'

# Response
{
  "status": "success",
  "data": {
    "message": "Open enrollment for 2025 benefits runs from November 1-30, 2024 [1]. During this period, you can enroll in new plans or make changes to your existing coverage [2].",
    "citations": [
      {
        "number": 1,
        "text": "2025 Open Enrollment Dates",
        "url": "https://www.aexp.com/benefits/enrollment#dates-2025",
        "category": "enrollment"
      },
      {
        "number": 2,
        "text": "What You Can Change During Open Enrollment",
        "url": "https://www.aexp.com/benefits/enrollment#changes",
        "category": "enrollment"
      }
    ],
    "confidence": 0.95
  }
}
```

### Example 2: Question with No Answer

```bash
# Request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the parking benefits?"}'

# Response
{
  "status": "success",
  "data": {
    "message": "I don't have information about parking benefits in the AmEx benefits database. Please visit the official benefits website for complete information.",
    "citations": [],
    "confidence": 0.15
  }
}
```

### Example 3: Invalid Request

```bash
# Request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'

# Response
{
  "status": "error",
  "error": "INVALID_INPUT",
  "message": "Message must be between 1 and 2000 characters"
}
```

### Example 4: Rate Limited

```bash
# After 10 requests in 60 seconds

# Response
{
  "status": "error",
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Maximum 10 requests per minute per IP.",
  "retryAfter": 45
}
```

### Example 5: Admin Re-index

```bash
# Request
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret-token" \
  -d '{}'

# Response
{
  "status": "success",
  "data": {
    "jobId": "reindex-2024-01-15-14-30-00",
    "startedAt": "2024-01-15T14:30:00Z",
    "pagesDiscovered": 48,
    "pagesCrawled": 48,
    "pagesFailed": 0,
    "chunksCreated": 542,
    "embeddingsGenerated": 542,
    "duration": 52000,
    "status": "success"
  }
}
```

---

## Error Handling Strategy

### Client-Side Error Handling

```javascript
// Frontend example
async function sendMessage(message) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    if (!response.ok) {
      const error = await response.json()

      if (response.status === 429) {
        // Rate limited - show retry message
        showError(`Please wait ${error.retryAfter}s before trying again`)
        return
      }

      if (response.status === 503) {
        // Service temporarily unavailable
        showError('Chat service is temporarily down. Please try again later.')
        return
      }

      // Generic error
      showError(error.message || 'Something went wrong')
      return
    }

    const data = await response.json()
    displayResponse(data.data)
  } catch (error) {
    showError('Network error. Please check your connection.')
  }
}
```

### Retry Logic

For client implementations, implement exponential backoff:

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Usage
const response = await withRetry(() => fetch('/api/chat', ...))
```

---

## Rate Limiting

### Limits

- **Chat endpoint**: 10 requests per minute per IP
- **Admin endpoints**: 5 requests per minute per token

### Response Headers

When rate limited, response includes:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705329645
Retry-After: 45
```

---

## Authentication

### Admin Token

Admin endpoints require a bearer token:

```
Authorization: Bearer <admin-token>
```

Token is configured via environment variable:
```env
ADMIN_TOKEN="your-secret-token-here"
```

For production, use more sophisticated auth (OAuth2, API keys with rotation, etc.).

---

## OpenAPI/Swagger Specification

For API documentation tools, OpenAPI spec available at:
- URL: `GET /api/openapi.json` (if enabled)
- UI: `GET /api/docs` (Swagger UI)

---

## CORS Configuration

By default, CORS is disabled (same-origin only). To enable for cross-origin requests:

**app/api/middleware.ts**:
```typescript
export function corsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}
```

---

## Monitoring & Logging

All API requests are logged with:
- Timestamp
- Request method and path
- Request size
- Response status code
- Response time
- Error message (if applicable)

Example log:
```
2024-01-15 14:32:45 POST /api/chat 200 1650ms 2.3KB
2024-01-15 14:32:50 POST /api/admin/reindex 200 52000ms 4.2KB
2024-01-15 14:33:02 POST /api/chat 429 2ms 0.5KB (rate limited)
```

---

## Testing the API

### Using cURL

```bash
# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is HSA?"}'

# Test admin re-index
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer test-token"

# Test admin status
curl -X GET http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer test-token"
```

### Using Postman

1. Import the collection: `postman-collection.json`
2. Set environment variables: `base_url`, `admin_token`
3. Run requests

### Using Insomnia

Similar to Postman - import `insomnia-collection.json`

---

## API Versioning

Current version: **v1**

Future versions will be available at `/api/v2/`, etc.

For now, all endpoints are at `/api/*`.

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design.
See [ROADMAP.md](./ROADMAP.md) for implementation timeline.
