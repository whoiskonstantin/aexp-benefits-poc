# DATABASE.md

Database schema, Prisma setup, and pgvector configuration.

## Database Overview

The application uses PostgreSQL with the pgvector extension for semantic search capabilities. Prisma ORM manages all database operations with type-safe client generation.

**Key Technologies:**
- PostgreSQL 15+ (latest stable)
- pgvector extension for vector similarity search
- Prisma ORM for type-safe database access
- Prisma Client for runtime queries

## Prisma Setup

### Installation

```bash
# Install Prisma and client
yarn add -D prisma
yarn add @prisma/client

# Initialize Prisma (generates .env and prisma/schema.prisma)
npx prisma init
```

### Configuration

**prisma/schema.prisma**:
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Page {
  id        Int      @id @default(autoincrement())
  url       String   @unique
  title     String
  crawledAt DateTime @default(now())
  chunks    Chunk[]

  @@map("pages")
}

model Chunk {
  id        Int      @id @default(autoincrement())
  pageId    Int
  page      Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  text      String   @db.Text
  embedding Unsupported("vector(1536)")?
  category  String
  sourceUrl String   @db.VarChar(2048)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([pageId])
  @@index([category])
  @@map("chunks")
}

model AdminLog {
  id        Int      @id @default(autoincrement())
  action    String
  status    String   // "success" | "error" | "pending"
  message   String?  @db.Text
  metadata  String?  @db.JsonB  // Additional context as JSON
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([action])
  @@map("admin_logs")
}
```

### Environment Setup

**.env.local**:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aexp_benefits"

# OpenAI
OPENAI_API_KEY="sk-..."

# AmEx Scraper
AMEX_BENEFITS_URL="https://www.aexp.com/benefits"

# Admin
ADMIN_TOKEN="your-secret-admin-token"

# Environment
NODE_ENV="development"
```

**Never commit `.env.local` to git**. Use `.env.example` for reference:

**.env.example**:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aexp_benefits"
OPENAI_API_KEY="sk-your-key-here"
AMEX_BENEFITS_URL="https://www.aexp.com/benefits"
ADMIN_TOKEN="your-secret-token"
NODE_ENV="development"
```

## Database Schema

### Table: `pages`

Stores information about crawled web pages.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, auto-increment |
| `url` | VARCHAR | Unique URL of the page |
| `title` | VARCHAR | Page title/heading |
| `crawledAt` | TIMESTAMP | When the page was crawled |

**Indexes:**
- `url` (UNIQUE) - Fast lookups by URL

**Example**:
```
id | url | title | crawledAt
1 | https://www.aexp.com/benefits/medical | Medical Plans | 2024-01-01 12:00:00
2 | https://www.aexp.com/benefits/retirement | Retirement Plans | 2024-01-01 12:05:00
```

### Table: `chunks`

Stores semantic chunks of content with embeddings for vector search.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, auto-increment |
| `pageId` | INTEGER | Foreign key to `pages` table |
| `text` | TEXT | The actual content chunk (512 tokens max) |
| `embedding` | vector(1536) | OpenAI embedding (text-embedding-3-large) |
| `category` | VARCHAR | Topic category (e.g., "medical", "retirement", "hsa") |
| `sourceUrl` | VARCHAR | Full URL to page where chunk came from |
| `createdAt` | TIMESTAMP | When chunk was created |
| `updatedAt` | TIMESTAMP | When chunk was last updated |

**Indexes:**
- `pageId` - Fast lookups by page
- `category` - Fast filtering by topic
- `embedding` (pgvector) - Vector similarity search

**Example**:
```
id | pageId | text | embedding | category | sourceUrl | createdAt
1 | 1 | "Our medical plans include... | [0.1, 0.2, ...] | medical | https://aexp.com/benefits/medical | 2024-01-01 12:00:00
2 | 1 | "Deductibles range from $500 to... | [0.15, 0.25, ...] | medical | https://aexp.com/benefits/medical | 2024-01-01 12:00:00
3 | 2 | "401(k) matching is 50% up to... | [0.05, 0.3, ...] | retirement | https://aexp.com/benefits/retirement | 2024-01-01 12:05:00
```

### Table: `admin_logs`

Audit log for admin actions (indexing, re-indexing, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, auto-increment |
| `action` | VARCHAR | Action name (e.g., "reindex", "clear_embeddings") |
| `status` | VARCHAR | "success", "error", "pending" |
| `message` | TEXT | Details or error message |
| `metadata` | JSONB | Additional context as JSON |
| `createdAt` | TIMESTAMP | When the action was performed |

**Indexes:**
- `createdAt` - Timeline of actions
- `action` - Filter by action type

**Example**:
```
id | action | status | message | metadata | createdAt
1 | reindex | success | Indexed 42 pages, 512 chunks | {"pagesIndexed": 42, "chunksCreated": 512} | 2024-01-01 13:00:00
2 | reindex | error | Timeout after 30s | {"pagesAttempted": 10, "error": "timeout"} | 2024-01-01 14:00:00
```

## pgvector Extension

### Enabling pgvector

The pgvector extension is automatically enabled in the Docker Compose setup. For manual setup:

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's installed
SELECT extname FROM pg_extension WHERE extname = 'vector';
```

### Vector Similarity Search

pgvector supports three distance metrics:

1. **Cosine Distance** (default, recommended for embeddings)
   ```sql
   -- Find most similar chunks to a query embedding
   SELECT id, text, 1 - (embedding <=> '[-0.1, 0.2, ...]'::vector) as similarity
   FROM chunks
   ORDER BY embedding <=> '[-0.1, 0.2, ...]'::vector
   LIMIT 5;
   ```

2. **L2 Distance** (Euclidean)
   ```sql
   SELECT id, text, embedding <-> '[-0.1, 0.2, ...]'::vector as distance
   FROM chunks
   ORDER BY embedding <-> '[-0.1, 0.2, ...]'::vector
   LIMIT 5;
   ```

3. **Inner Product** (for dot product similarity)
   ```sql
   SELECT id, text, embedding <#> '[-0.1, 0.2, ...]'::vector as inner_product
   FROM chunks
   ORDER BY embedding <#> '[-0.1, 0.2, ...]'::vector DESC
   LIMIT 5;
   ```

### Prisma pgvector Queries

Using Prisma with pgvector:

```typescript
// lib/search.ts
import { Prisma } from '@prisma/client'
import prisma from './prisma'

export async function searchChunks(
  embedding: number[],
  topK: number = 5
): Promise<any[]> {
  const results = await prisma.$queryRaw`
    SELECT
      id,
      text,
      "pageId",
      category,
      "sourceUrl",
      1 - (embedding <=> ${Prisma.raw(`'[${embedding.join(',')}]'::vector`)}) as similarity
    FROM chunks
    ORDER BY embedding <=> ${Prisma.raw(`'[${embedding.join(',')}]'::vector`)}
    LIMIT ${topK}
  `
  return results
}
```

**Note**: Prisma's ORM support for pgvector is limited, so raw SQL queries are sometimes necessary. This is expected and acceptable.

## Migrations

### Create Initial Schema

```bash
# Create and apply initial migration
npx prisma migrate dev --name init

# This will:
# 1. Create the migration file in prisma/migrations/
# 2. Apply it to the database
# 3. Generate Prisma Client
```

### Generate after Schema Changes

```bash
# After modifying prisma/schema.prisma, create a new migration
npx prisma migrate dev --name <migration_name>

# Example:
npx prisma migrate dev --name add_metadata_to_chunks
```

### Apply Migrations in Production

```bash
# Deploy migrations without generating Prisma Client
npx prisma migrate deploy

# This should be run during deployment before starting the app
```

## Prisma Client Usage

### Setup Singleton

**lib/prisma.ts**:
```typescript
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
```

### Common Operations

**Create a page**:
```typescript
const page = await prisma.page.create({
  data: {
    url: 'https://example.com',
    title: 'Example Page',
  },
})
```

**Create chunks with embeddings**:
```typescript
const chunks = await prisma.chunk.createMany({
  data: [
    {
      pageId: 1,
      text: 'Content here...',
      embedding: [0.1, 0.2, ...], // 1536 dimensions
      category: 'medical',
      sourceUrl: 'https://example.com',
    },
    // More chunks...
  ],
})
```

**Find chunks by category**:
```typescript
const medicalChunks = await prisma.chunk.findMany({
  where: { category: 'medical' },
  take: 10,
})
```

**Update page**:
```typescript
await prisma.page.update({
  where: { id: 1 },
  data: { crawledAt: new Date() },
})
```

**Delete old chunks**:
```typescript
await prisma.chunk.deleteMany({
  where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
})
```

**Admin logging**:
```typescript
await prisma.adminLog.create({
  data: {
    action: 'reindex',
    status: 'success',
    message: 'Indexed 42 pages',
    metadata: {
      pagesIndexed: 42,
      chunksCreated: 512,
      duration: 45000,
    },
  },
})
```

## Prisma Studio

Interactive database explorer:

```bash
# Open Prisma Studio in browser (http://localhost:5555)
npx prisma studio

# View and edit data visually
# Create, read, update, delete records
# Execute raw SQL queries
```

## Connection Pooling

For production, enable connection pooling:

**prisma/schema.prisma**:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")

  // Optional: use PgBouncer or PgCat for pooling
  // url = env("DATABASE_POOL_URL")
}
```

### PgBouncer Configuration

For high-traffic scenarios, use PgBouncer:

**pgbouncer.ini**:
```ini
[databases]
aexp_benefits = host=localhost port=5432 dbname=aexp_benefits

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
```

## Performance Optimization

### Indexes

Indexes already defined in schema:
- `pages.url` (UNIQUE)
- `chunks.pageId` (foreign key)
- `chunks.category` (topic filtering)
- `chunks.embedding` (vector search, auto-created by pgvector)
- `admin_logs.createdAt` (timeline queries)
- `admin_logs.action` (action filtering)

### Query Optimization

**Use indexes effectively**:
```typescript
// Good: Uses category index
await prisma.chunk.findMany({
  where: { category: 'medical' },
  take: 10,
})

// Better: Combine with pagination
await prisma.chunk.findMany({
  where: { category: 'medical' },
  skip: 0,
  take: 10,
  orderBy: { createdAt: 'desc' },
})

// Avoid: Full table scan
await prisma.chunk.findMany()
// ^ Without WHERE, takes all rows
```

### Vector Search Performance

For large embeddings tables (>10M chunks):

1. Use HNSW indexing (pgvector built-in):
   ```sql
   CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
   ```

2. Consider partitioning by category:
   ```sql
   CREATE TABLE chunks_medical PARTITION OF chunks
   FOR VALUES IN ('medical');
   ```

## Backup & Restore

### Docker Backup

```bash
# Backup database to file
docker-compose exec postgres pg_dump -U postgres aexp_benefits > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres aexp_benefits < backup.sql
```

### Automated Backups

For production, use tools like:
- AWS RDS automated backups
- pg_basebackup for continuous backup
- WAL archiving for point-in-time recovery

## Troubleshooting

### Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# View logs
docker-compose logs postgres

# Test connection
psql -h localhost -U postgres -d aexp_benefits
```

### pgvector Not Found

```bash
# Verify pgvector is installed
psql -d aexp_benefits -c "CREATE EXTENSION vector;"

# Check installed extensions
psql -d aexp_benefits -c "SELECT * FROM pg_extension;"
```

### Prisma Sync Issues

```bash
# Regenerate Prisma Client
npx prisma generate

# Reset database (development only!)
npx prisma migrate reset

# Validate schema
npx prisma validate
```

### Slow Queries

```bash
# Enable query logging
# In postgres docker-compose, add:
# command: postgres -c log_statement=all

# Analyze query performance
EXPLAIN ANALYZE <query>

# E.g., vector search performance
EXPLAIN ANALYZE
SELECT id, text, 1 - (embedding <=> ARRAY[...]) as similarity
FROM chunks
ORDER BY embedding <=> ARRAY[...]
LIMIT 5;
```

## Next Steps

1. Set up `.env.local` with DATABASE_URL
2. Run `docker-compose up -d` to start PostgreSQL
3. Run `npx prisma migrate dev --name init` to create schema
4. Use Prisma Client in your application code

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Docker setup details.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow diagrams.
