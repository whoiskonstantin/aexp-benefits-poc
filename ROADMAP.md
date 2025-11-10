# ROADMAP.md

Development roadmap with phases, milestones, and implementation order.

## Roadmap Overview

```
Phase 1: Foundation          (Week 1)
├── Database Setup
└── Project Configuration

Phase 2: Data & Search      (Week 2)
├── Web Scraper
├── Content Indexing
└── Semantic Search

Phase 3: LLM Integration    (Week 2-3)
├── OpenAI Integration
└── Response Generation

Phase 4: User Interface     (Week 3)
├── Chat Component
├── Chat Page
└── UI Polish

Phase 5: Admin & Ops        (Week 4)
├── Re-index Endpoint
├── Status Monitoring
└── Admin Dashboard (optional)

Phase 6: Quality & Deploy   (Week 4-5)
├── Error Handling
├── Input Validation
├── Testing
└── Deployment Setup
```

---

## Phase 1: Foundation & Infrastructure (Week 1)

**Goal**: Set up database, project structure, and configuration

### Phase 1.1: Environment & Config
- [ ] Create `.env.local` template
- [ ] Add environment variable validation
- [ ] Configure Prisma database URL
- [ ] Set up TypeScript paths and aliases

**Deliverables**: `.env.local`, configuration validated

**Time Estimate**: 1-2 hours

### Phase 1.2: Docker & PostgreSQL
- [ ] Create `docker-compose.yml` with PostgreSQL 15+
- [ ] Enable pgvector extension
- [ ] Create initialization scripts
- [ ] Document how to start/stop database
- [ ] Verify connection from Node.js

**Deliverables**: Working Docker Compose setup, database running locally

**Time Estimate**: 2-3 hours

**Commands**:
```bash
docker-compose up -d
docker-compose down
```

### Phase 1.3: Prisma Setup
- [ ] Install Prisma: `yarn add -D prisma @prisma/client`
- [ ] Initialize Prisma: `npx prisma init`
- [ ] Create Prisma schema with Page and Chunk models
- [ ] Run migrations: `npx prisma migrate dev --name init`
- [ ] Set up Prisma Client singleton (`lib/prisma.ts`)

**Deliverables**: Prisma configured, schema created, migrations working

**Time Estimate**: 2-3 hours

**Commands**:
```bash
yarn add -D prisma @prisma/client
npx prisma init
npx prisma migrate dev --name init
npx prisma studio  # Visual database explorer
```

### Phase 1.4: Project Structure
- [ ] Create directories: `lib/`, `components/`, `types/`
- [ ] Set up validation schemas (`lib/validation.ts`)
- [ ] Create utilities directory structure
- [ ] Add helper functions for common tasks

**Deliverables**: Clean project structure ready for implementation

**Time Estimate**: 1 hour

---

## Phase 2: Data Pipeline (Week 2)

**Goal**: Crawl content, chunk it, and make it searchable

### Phase 2.1: Web Scraper
- [ ] Install dependencies: `cheerio`, `axios`, `robotparser`
- [ ] Create web scraper (`lib/scraper.ts`)
  - [ ] Fetch pages from AmEx /benefits/ path
  - [ ] Parse HTML with cheerio
  - [ ] Extract headings, paragraphs, and structure
  - [ ] Respect robots.txt
  - [ ] Implement rate limiting (1 request per second)
  - [ ] Handle errors gracefully
- [ ] Test scraper with sample URLs
- [ ] Log crawled pages and errors

**Deliverables**: Working scraper that retrieves and parses content

**Time Estimate**: 4-5 hours

**Example Output**:
```typescript
interface ScrapedPage {
  url: string
  title: string
  headings: string[]
  paragraphs: string[]
  content: string
}
```

### Phase 2.2: Content Chunking
- [ ] Create chunking logic (`lib/chunking.ts`)
  - [ ] Split pages into ~512 token chunks
  - [ ] Preserve source URLs and hierarchy
  - [ ] Handle edge cases (lists, tables, code blocks)
  - [ ] Overlap chunks for better context
- [ ] Test with various page lengths
- [ ] Verify chunk quality

**Deliverables**: Semantic chunking algorithm working correctly

**Time Estimate**: 3-4 hours

**Example Output**:
```typescript
interface Chunk {
  text: string
  pageUrl: string
  category: string  // e.g., "medical", "retirement"
  pageTitle: string
}
```

### Phase 2.3: Embedding Generation
- [ ] Install OpenAI SDK: `yarn add openai`
- [ ] Create embedding client (`lib/embeddings.ts`)
  - [ ] Configure OpenAI API key
  - [ ] Batch embedding requests (to save cost)
  - [ ] Use text-embedding-3-large model
  - [ ] Handle API errors and retries
- [ ] Test embedding generation
- [ ] Verify embeddings are stored correctly

**Deliverables**: Embeddings generated and stored in pgvector

**Time Estimate**: 2-3 hours

### Phase 2.4: Indexing Pipeline
- [ ] Create full indexing orchestrator (`lib/indexer.ts`)
  - [ ] Crawl pages
  - [ ] Chunk content
  - [ ] Generate embeddings
  - [ ] Store in database
  - [ ] Handle upserts (prevent duplicates)
- [ ] Add logging and progress tracking
- [ ] Test full pipeline with sample site

**Deliverables**: End-to-end indexing working

**Time Estimate**: 3-4 hours

**Example Command**:
```bash
node scripts/index.ts  # Full re-index
```

### Phase 2.5: Vector Search
- [ ] Create search engine (`lib/search.ts`)
  - [ ] Convert query to embedding
  - [ ] Use Prisma + pgvector for similarity search
  - [ ] Return top-K results with relevance scores
  - [ ] Format results with source metadata
- [ ] Test search quality
- [ ] Verify performance (<1 second queries)

**Deliverables**: Semantic search working, fast and accurate

**Time Estimate**: 2-3 hours

**Example**:
```typescript
const results = await searchChunks("When is open enrollment?", 5)
// Returns: [
//   { text: "...", url: "...", similarity: 0.92 },
//   { text: "...", url: "...", similarity: 0.88 },
//   ...
// ]
```

---

## Phase 3: LLM Integration (Week 2-3)

**Goal**: Generate natural language responses with citations

### Phase 3.1: Response Generation
- [ ] Create LLM client (`lib/response-generator.ts`)
  - [ ] Configure OpenAI GPT-4o
  - [ ] Build system prompt enforcing citations
  - [ ] Format search results as context
  - [ ] Parse LLM response
  - [ ] Extract citations and format as [1], [2], etc.
- [ ] Test response quality
- [ ] Verify citations are accurate

**Deliverables**: LLM integration working with proper citations

**Time Estimate**: 3-4 hours

**System Prompt Example**:
```
You are an AmEx benefits assistant. Answer questions based ONLY on the
provided policy sections. For each claim, include a citation like [1].
Always number citations sequentially. If you're not confident, say so.
Never make up information.
```

### Phase 3.2: Citation Formatting
- [ ] Create citation formatter (`lib/citation-formatter.ts`)
  - [ ] Extract source URLs from search results
  - [ ] Number citations [1], [2], etc.
  - [ ] Create clickable links
  - [ ] Validate URLs
- [ ] Test citation accuracy
- [ ] Verify all citations are verifiable

**Deliverables**: Citations formatted correctly and verifiable

**Time Estimate**: 2 hours

### Phase 3.3: Confidence & Fallback
- [ ] Implement confidence scoring
  - [ ] Use average similarity distance of search results
  - [ ] Set minimum confidence threshold (e.g., 0.7)
  - [ ] Return "I don't know" if confidence too low
- [ ] Test edge cases (no results, low confidence)
- [ ] Verify graceful degradation

**Deliverables**: System avoids hallucination and low-confidence answers

**Time Estimate**: 2 hours

---

## Phase 4: Chat API & UI (Week 3)

**Goal**: Build chat endpoint and user interface

### Phase 4.1: Chat API Endpoint
- [ ] Create `/api/chat` route (`app/api/chat/route.ts`)
  - [ ] POST handler for chat requests
  - [ ] Accept JSON: `{ message: string }`
  - [ ] Validate input (Zod schema)
  - [ ] Call search engine
  - [ ] Call LLM client
  - [ ] Format response
  - [ ] Return JSON: `{ message: string, citations: Citation[] }`
- [ ] Add error handling
- [ ] Add request logging

**Deliverables**: Working chat API endpoint

**Time Estimate**: 3-4 hours

**API Spec**:
```
POST /api/chat
Content-Type: application/json

Request:
{
  "message": "What is the HSA contribution limit?"
}

Response:
{
  "message": "The 2024 HSA contribution limit is $4,150 for individuals...",
  "citations": [
    { "text": "[1]", "url": "https://amex.com/benefits/retirement#hsa" },
    { "text": "[2]", "url": "https://amex.com/benefits/retirement#fsa" }
  ]
}
```

### Phase 4.2: Chat Component
- [ ] Create chat UI component (`components/ChatInterface.tsx`)
  - [ ] Message history state management
  - [ ] User and assistant message rendering
  - [ ] Citation rendering with clickable links
  - [ ] Input field and send button
  - [ ] Loading state (spinner)
  - [ ] Error state (error message)
  - [ ] Mobile-responsive layout
  - [ ] Keyboard support (Enter to send)
  - [ ] Clear conversation button
- [ ] Style with Tailwind CSS
- [ ] Test responsiveness

**Deliverables**: Beautiful, responsive chat component

**Time Estimate**: 4-5 hours

**Features**:
- Messages display in chronological order
- Timestamps for each message
- Typing indicator while loading
- Error messages
- Syntax highlighting for code blocks (if any)
- Copy message to clipboard

### Phase 4.3: Chat Page
- [ ] Create chat page (`app/chat/page.tsx`)
  - [ ] Wrap ChatInterface component
  - [ ] Set page layout and styling
  - [ ] Add page title and metadata
  - [ ] Optional: Add sidebar with example questions
- [ ] Update navigation to link to chat page
- [ ] Test page loading and rendering

**Deliverables**: Chat page working and accessible

**Time Estimate**: 2 hours

### Phase 4.4: UI Polish
- [ ] Improve visual design
  - [ ] Refine colors and typography
  - [ ] Add hover effects and animations
  - [ ] Improve spacing and alignment
  - [ ] Add icons for messages (user, AI, citations)
- [ ] Improve accessibility
  - [ ] Add ARIA labels
  - [ ] Ensure keyboard navigation works
  - [ ] Test screen reader compatibility
- [ ] Dark mode verification

**Deliverables**: Polished, accessible UI

**Time Estimate**: 3-4 hours

---

## Phase 5: Admin Operations (Week 4)

**Goal**: Enable admin to manage content and monitor system

### Phase 5.1: Re-index API
- [ ] Create `/api/admin/reindex` endpoint (`app/api/admin/reindex/route.ts`)
  - [ ] POST handler
  - [ ] Verify admin token/authentication
  - [ ] Clear existing chunks and embeddings
  - [ ] Run full indexing pipeline
  - [ ] Return status: pages indexed, chunks created, embeddings generated
  - [ ] Log re-index event to admin_logs table
- [ ] Add retry logic
- [ ] Add progress tracking

**Deliverables**: Admin can trigger content re-indexing

**Time Estimate**: 3-4 hours

**API Spec**:
```
POST /api/admin/reindex
Authorization: Bearer <admin-token>

Response:
{
  "status": "success",
  "pagesIndexed": 42,
  "chunksCreated": 512,
  "embeddingsGenerated": 512,
  "duration": 45000  // ms
}
```

### Phase 5.2: Status Endpoint
- [ ] Create `/api/admin/status` endpoint (`app/api/admin/status/route.ts`)
  - [ ] GET handler
  - [ ] Return last re-index timestamp
  - [ ] Return total chunks and pages in database
  - [ ] Return system health metrics
- [ ] Add caching to avoid expensive queries

**Deliverables**: Admin can check system status

**Time Estimate**: 2 hours

### Phase 5.3: Admin Dashboard (Optional)
- [ ] Create admin page (`app/admin/page.tsx`)
  - [ ] Display system status
  - [ ] Show recent re-index history
  - [ ] Provide re-index button
  - [ ] Show error logs
- [ ] Add admin authentication
- [ ] Add authorization checks

**Deliverables**: Optional admin UI (can skip for MVP)

**Time Estimate**: 3-4 hours (optional)

---

## Phase 6: Quality & Deployment (Week 4-5)

**Goal**: Production-ready, tested, documented code

### Phase 6.1: Input Validation
- [ ] Create validation schemas (`lib/validation.ts`)
  - [ ] Chat message validation (max length, etc.)
  - [ ] Query parameter validation
  - [ ] Admin token validation
- [ ] Add validation to all API endpoints
- [ ] Add Zod schemas for all request/response types

**Deliverables**: All inputs validated and sanitized

**Time Estimate**: 2-3 hours

### Phase 6.2: Error Handling
- [ ] Add try-catch to all async functions
- [ ] Create error handling middleware
  - [ ] Log all errors with context
  - [ ] Return appropriate HTTP status codes
  - [ ] Return user-friendly error messages
  - [ ] Don't leak sensitive information
- [ ] Add circuit breaker for OpenAI API
- [ ] Implement retry logic with exponential backoff
- [ ] Add monitoring and alerting

**Deliverables**: Robust error handling throughout

**Time Estimate**: 3-4 hours

### Phase 6.3: Rate Limiting
- [ ] Install rate limiting middleware
- [ ] Add rate limiting to `/api/chat`
  - [ ] Max 10 requests per minute per IP
  - [ ] Max 100 requests per day per user (if auth)
- [ ] Return 429 Too Many Requests when limit exceeded

**Deliverables**: API protected from abuse

**Time Estimate**: 1-2 hours

### Phase 6.4: Security Hardening
- [ ] Verify environment variables are secret
- [ ] Add CORS if frontend hosted separately
- [ ] Sanitize all user input
- [ ] Add security headers
- [ ] Review for common vulnerabilities (OWASP Top 10)

**Deliverables**: Security best practices implemented

**Time Estimate**: 2-3 hours

### Phase 6.5: Testing
- [ ] Create unit tests for search engine
- [ ] Create unit tests for chunking logic
- [ ] Create integration tests for API endpoints
- [ ] Create E2E test for chat workflow
- [ ] Mock external services (OpenAI, web scraper)
- [ ] Aim for >80% code coverage

**Deliverables**: Comprehensive test suite

**Time Estimate**: 5-6 hours

### Phase 6.6: Documentation
- [ ] Update CLAUDE.md with latest info
- [ ] Create API documentation (OpenAPI/Swagger)
- [ ] Create deployment guide
- [ ] Create troubleshooting guide
- [ ] Document environment variables
- [ ] Create backup/restore procedures

**Deliverables**: Complete documentation

**Time Estimate**: 3-4 hours

### Phase 6.7: Deployment Setup
- [ ] Create production environment variables
- [ ] Create Docker image for app
- [ ] Test Docker build locally
- [ ] Set up deployment script
- [ ] Document deployment steps

**Deliverables**: App ready to deploy

**Time Estimate**: 2-3 hours

---

## Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Foundation | 6-9 hours | Docker, Prisma, Config |
| Phase 2: Data Pipeline | 12-15 hours | Scraper, Indexing, Search |
| Phase 3: LLM Integration | 7-9 hours | Chat API, Citations |
| Phase 4: Chat UI | 9-12 hours | Chat Component, Page, Polish |
| Phase 5: Admin Ops | 5-8 hours | Re-index, Status, Admin Dashboard |
| Phase 6: Quality & Deploy | 16-20 hours | Testing, Security, Docs |
| **Total (MVP)** | **50-65 hours** | **Working chat POC** |
| **Total (with tests)** | **60-75 hours** | **Production-ready** |

---

## Milestones

### Milestone 1: Data Indexing Complete ✓
- Database running
- Content crawled and indexed
- Vector embeddings stored
- Search functional
- **Target**: End of Week 2

### Milestone 2: Chat API Working ✓
- Chat endpoint implemented
- LLM integration complete
- Citations formatted correctly
- **Target**: Mid Week 3

### Milestone 3: Chat UI Complete ✓
- Chat component built
- Chat page functional
- UI polished and responsive
- **Target**: End of Week 3

### Milestone 4: Admin & Operations ✓
- Re-index endpoint working
- Status monitoring available
- Admin dashboard (optional)
- **Target**: Early Week 4

### Milestone 5: Production Ready ✓
- All tests passing
- Documentation complete
- Security hardened
- Deployment tested
- **Target**: End of Week 4-5

---

## Dependencies & Blocking

```
Phase 1 ────────────────────────────────────────────────────┐
         ↓                                                    │
Phase 2 ──────────────────────────────────────────────┐    │
         ↓                                             │    │
Phase 3 ──────────────────────────────────┐          │    │
         ↓                                 │          │    │
Phase 4 ──────────────────────────┐       │          │    │
         ↓                        │       │          │    │
Phase 5 ──────┐                 │       │          │    │
         ↓    │                 │       │          │    │
Phase 6 ──────▼─────────────────▼───────▼──────────▼────▼──→
(Testing, Security, Docs, Deployment)
```

- Phase 1 must complete before Phase 2
- Phase 2 must complete before Phase 3
- Phase 3 must complete before Phase 4
- Phase 4, 5, 6 can overlap after Phase 3

---

## Success Criteria

By end of roadmap:

- [ ] Chat answers >95% accurate
- [ ] Citations >99% verifiable
- [ ] Response time <3 seconds
- [ ] Zero security vulnerabilities
- [ ] Test coverage >80%
- [ ] Documentation complete
- [ ] Deployment automated

---

## Next Steps

1. **Start Phase 1**: Set up database and Prisma
2. **Allocate resources**: Assign team members to each phase
3. **Track progress**: Update roadmap weekly
4. **Communicate blockers**: Escalate early if dependencies missed
5. **Iterate feedback**: Gather user feedback after each phase

See [FEATURES.md](./FEATURES.md) for detailed feature descriptions.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design.
