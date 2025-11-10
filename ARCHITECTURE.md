# ARCHITECTURE.md

High-level system architecture for the AmEx Benefits Chat POC.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         End User                             │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   ┌────▼──────────┐      ┌──────▼────────┐
   │   Chat UI     │      │  Admin Panel   │
   │  (React 19)   │      │   (Future)     │
   └────┬──────────┘      └──────┬────────┘
        │                        │
        │ HTTPS                  │ HTTPS
        │                        │
   ┌────▼──────────────────────▼──────┐
   │      Next.js Frontend + API      │
   │       (App Router)               │
   ├────────────────────────────────┤
   │ Routes:                         │
   │ - GET  /                        │
   │ - GET  /chat                    │
   │ - POST /api/chat               │
   │ - POST /api/admin/reindex      │
   │ - GET  /api/admin/status       │
   └────┬─────────────────────────────┘
        │
        ├──────────────────┬──────────────────┬────────────────┐
        │                  │                  │                │
   ┌────▼──────────┐  ┌───▼────────┐  ┌─────▼─────┐  ┌───────▼───────┐
   │ Search Layer  │  │ LLM Client  │  │ Web        │  │ Admin          │
   │ (Prisma +     │  │ (OpenAI)    │  │ Scraper    │  │ Management     │
   │  pgvector)    │  │             │  │            │  │                │
   └────┬──────────┘  └───┬────────┘  └─────┬──────┘  └────────┬───────┘
        │                 │                 │                 │
        │ Vector          │ Embeddings      │ Content         │ Admin
        │ Similarity      │ & Chat API      │ Crawling        │ Commands
        │ Search          │ Calls           │                 │
        │                 │                 │                 │
   ┌────▼──────────────────▼─────────────────▼─────────────────▼──────┐
   │              Database Layer (PostgreSQL)                          │
   ├───────────────────────────────────────────────────────────────┤
   │ Tables:                                                        │
   │ - pages        (url, title, crawledAt)                       │
   │ - chunks       (text, embedding, category, source_url)       │
   │ - admin_logs   (action, status, createdAt)                   │
   │                                                                │
   │ Extensions:                                                    │
   │ - pgvector     (for vector similarity search)                 │
   └────────────────────────────────────────────────────────────────┘
        │
        │ Connection
        │
   ┌────▼─────────────────────────┐
   │   PostgreSQL 15+             │
   │   (Docker Container)         │
   │   Port: 5432                 │
   │   Data: /data/postgres       │
   └──────────────────────────────┘

External Services:

   ┌─────────────────────────┐        ┌──────────────────────┐
   │  OpenAI API             │        │  AmEx Benefits Site  │
   │  - Embeddings          │        │  - Web Scraping      │
   │  - GPT-4o Chat         │        │  - Public Pages      │
   └────────┬────────────────┘        └──────────┬───────────┘
            │                                    │
            └────────────┬─────────────────────┬─┘
                         │                     │
                    Uses for               Source of
                    Search &           Content to Index
                    Responses
```

## Data Flow

### Chat Query Flow
```
1. User Types Query
         ↓
2. Chat UI sends POST /api/chat with message
         ↓
3. Chat API receives request
         ↓
4. Input Validation (Zod schema, rate limiting)
         ↓
5. Generate Embedding for user query (OpenAI API)
         ↓
6. Vector Search in pgvector (find top-K similar chunks)
         ↓
7. Format Search Results as Context
         ↓
8. Call OpenAI GPT-4o with context + system prompt
         ↓
9. Parse LLM Response (extract citations)
         ↓
10. Format Citations as numbered links
         ↓
11. Return JSON to Chat UI
         ↓
12. Chat UI renders message with clickable citations
```

### Content Indexing Flow
```
1. Admin triggers POST /api/admin/reindex
         ↓
2. Clear existing chunks and embeddings from DB
         ↓
3. Crawl AmEx /benefits/ pages
         ↓
4. Parse HTML (cheerio) to extract content
         ↓
5. Chunk long pages into semantic segments
         ↓
6. Generate embeddings for each chunk (OpenAI API - batched)
         ↓
7. Store chunks with embeddings in PostgreSQL
         ↓
8. Return status: pages crawled, chunks created, embeddings generated
         ↓
9. Update admin_logs with re-index timestamp
```

## Core Components

### Frontend Layer

**Chat UI Component** (`components/ChatInterface.tsx`)
- Manages message history state
- Renders user and assistant messages
- Handles citation formatting and clickable links
- Implements loading and error states
- Mobile-responsive layout with Tailwind CSS

**Chat Page** (`app/chat/page.tsx`)
- Server component that loads chat layout
- Wraps ChatInterface component
- Handles page metadata and SEO

**Home Page** (`app/page.tsx`)
- Landing/welcome page
- Navigation to chat interface
- Brief explanation of system

### API Layer

**Chat Endpoint** (`app/api/chat/route.ts`)
- POST handler for chat requests
- Validates input with Zod
- Orchestrates search → LLM → formatting
- Returns JSON with message and citations

**Re-index Endpoint** (`app/api/admin/reindex/route.ts`)
- POST handler to trigger content indexing
- Orchestrates crawl → chunk → embed → store
- Returns indexing status and counts

**Status Endpoint** (`app/api/admin/status/route.ts`)
- GET handler for indexing status
- Returns timestamp of last re-index
- Returns chunk count and page count

### Business Logic Layer

**Search Engine** (`lib/search.ts`)
```typescript
// Converts query to embedding and finds similar chunks
export async function searchChunks(
  query: string,
  topK: number = 5
): Promise<Chunk[]>
```

**LLM Integration** (`lib/llm.ts`)
```typescript
// Calls OpenAI GPT-4o with context
export async function generateResponse(
  query: string,
  context: Chunk[]
): Promise<{ message: string; citations: Citation[] }>
```

**Web Scraper** (`lib/scraper.ts`)
```typescript
// Crawls AmEx benefits pages
export async function crawlBenefitsPages(): Promise<Page[]>
```

**Content Chunking** (`lib/chunking.ts`)
```typescript
// Splits pages into semantic chunks
export async function chunkPage(page: Page): Promise<Chunk[]>
```

**Indexing Pipeline** (`lib/indexer.ts`)
```typescript
// Orchestrates full re-index process
export async function reindexContent(): Promise<{
  pagesIndexed: number
  chunksCreated: number
  embeddingsGenerated: number
}>
```

### Data Layer

**Prisma Client** (`lib/prisma.ts`)
- Singleton instance of Prisma client
- Connection pooling configuration
- Used by all data access functions

**Database Models** (prisma/schema.prisma)
```prisma
model Page {
  id        Int      @id @default(autoincrement())
  url       String   @unique
  title     String
  crawledAt DateTime @default(now())
  chunks    Chunk[]
}

model Chunk {
  id        Int      @id @default(autoincrement())
  pageId    Int
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  text      String
  embedding Unsupported("vector")?
  category  String
  sourceUrl String
  createdAt DateTime @default(now())

  @@index([pageId])
}

model AdminLog {
  id        Int      @id @default(autoincrement())
  action    String
  status    String
  message   String?
  createdAt DateTime @default(now())
}
```

## Key Design Decisions

### 1. Prisma ORM with pgvector
**Why**: Prisma provides type-safe database access with native pgvector support, reducing boilerplate and improving developer experience. Better than raw SQL for migrations and schema management.

### 2. OpenAI for Embeddings and Chat
**Why**: Industry-standard embeddings (text-embedding-3-large) and GPT-4o provides superior reasoning. Trade-off: API costs, but acceptable for POC.

### 3. Semantic Chunking
**Why**: Breaking long pages into semantic units improves search relevance and reduces token usage in LLM calls. More efficient than storing entire pages as single embeddings.

### 4. Vector Similarity Search via pgvector
**Why**: Avoids external vector database dependency, keeps data in one place (PostgreSQL). pgvector is performant for POC-scale data.

### 5. Server Components by Default
**Why**: Next.js 16 Server Components allow safe secrets handling and reduced client bundle size. Only Chat UI marked as "use client" for interactivity.

### 6. Manual Re-indexing
**Why**: Gives admin control over when content is refreshed. Simpler than scheduling system for POC. Can be enhanced later with background jobs.

### 7. Citation Enforcement via System Prompt
**Why**: Instead of post-processing LLM output, system prompt instructs model to include citations in specific format. More reliable than trying to extract citations afterward.

## Scalability Considerations

### For Production
- **Vector Embeddings**: Consider moving to dedicated vector database (Pinecone, Weaviate) if corpus grows >100k chunks
- **LLM API**: Implement caching layer to reduce OpenAI API calls
- **Database**: Add read replicas for high-traffic scenarios
- **Search Index**: Add full-text search alongside vector search for better results
- **Background Jobs**: Use Bull or similar for asynchronous indexing
- **Rate Limiting**: Implement more sophisticated rate limiting (per-user, per-API-key)

### For This POC
- Single PostgreSQL instance
- Direct OpenAI API calls
- Synchronous request handling
- Manual re-indexing
- No advanced caching

## Error Handling & Resilience

### Circuit Breaker Pattern
If OpenAI API fails, return cached response or "I don't know" message

### Retry Logic
- Exponential backoff for transient errors
- Max 3 retries for API calls
- Timeout: 30 seconds per API call

### Logging
- All requests logged with timestamp and duration
- API errors logged with full context
- Search results logged for relevance analysis

## Security Considerations

1. **API Keys**: Stored in `.env.local`, never committed to git
2. **Input Validation**: Zod schemas validate all user input
3. **Rate Limiting**: Prevent abuse of chat endpoint
4. **CORS**: Configure if frontend hosted separately
5. **Admin Authentication**: Token-based auth for re-index endpoint
6. **Data Privacy**: No user data stored; stateless chat
7. **HTML Sanitization**: DOMPurify or similar to prevent XSS

## Dependencies Between Components

```
ChatInterface (UI)
    ↓
ChatAPI (/api/chat)
    ├→ InputValidator
    ├→ SearchEngine (lib/search.ts)
    ├→ LLMClient (lib/llm.ts)
    └→ CitationFormatter

SearchEngine
    ├→ Prisma Client
    ├→ OpenAI (embeddings)
    └→ pgvector

LLMClient
    ├→ OpenAI (GPT-4o)
    └→ SearchResults

ReindexAPI (/api/admin/reindex)
    ├→ WebScraper (lib/scraper.ts)
    ├→ ContentChunker (lib/chunking.ts)
    ├→ EmbeddingGenerator
    └→ Prisma Client

WebScraper
    ├→ axios (HTTP)
    ├→ cheerio (HTML parsing)
    └→ robots.txt parser
```

## Next Steps

For implementation, see [ROADMAP.md](./ROADMAP.md) for phased approach.
For database schema details, see [DATABASE.md](./DATABASE.md).
For API documentation, see [API.md](./API.md).
For deployment setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).
