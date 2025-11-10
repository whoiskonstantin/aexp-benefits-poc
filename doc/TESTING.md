# TESTING.md

Testing guide with curl commands for the AmEx Benefits Chat API.

## Quick Start

### 1. Start Services

```bash
# Start PostgreSQL and pgAdmin
docker-compose up -d

# Start Next.js dev server
yarn dev

# (Optional) View database
npx prisma studio
```

### 2. Verify Services

```bash
# Check PostgreSQL is running
docker-compose ps

# Check dev server is running
lsof -i :3000
```

## API Testing with curl

### 1. Health Check

```bash
# Chat API health check
curl -s http://localhost:3000/api/chat | jq .

# Admin status endpoint
curl -s http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production" | jq .
```

### 2. Chat API - POST /api/chat

#### Test 1: Simple Question

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the HSA contribution limit?"}'
```

Expected Response:
```json
{
  "status": "success",
  "data": {
    "message": "The HSA contribution limit for 2024 is $4,150 for individuals and $8,300 for families [1].",
    "citations": [
      {
        "number": 1,
        "text": "Retirement Plans",
        "url": "https://www.aexp.com/benefits/retirement"
      }
    ],
    "confidence": 0.28
  }
}
```

#### Test 2: Medical Plans Question

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tell me about medical plan options and deductibles"}'
```

#### Test 3: Open Enrollment Question

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"When is the 2025 open enrollment period?"}'
```

#### Test 4: Dental Coverage Question

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is covered under the dental plan?"}'
```

#### Test 5: Vision Benefits Question

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What vision services are covered?"}'
```

#### Test 6: Empty Input (Error)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":""}'
```

Expected Error:
```json
{
  "status": "error",
  "error": "INVALID_INPUT",
  "message": "Message cannot be empty"
}
```

#### Test 7: Long Message (Error)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$(python3 -c 'print("x" * 2001)')\"}"
```

Expected Error:
```json
{
  "status": "error",
  "error": "INVALID_INPUT",
  "message": "Message exceeds maximum length"
}
```

#### Test 8: Pretty Print JSON

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the FSA contribution limit?"}' | jq .
```

### 3. Admin Endpoints - GET /api/admin/status

```bash
# Get system and indexing status
curl -s http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production" | jq .

# Pretty format specific fields
curl -s http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production" | jq '.data.indexing'
```

### 4. Admin Endpoints - POST /api/admin/reindex

#### Trigger Re-indexing

```bash
# Trigger content re-indexing
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production" \
  -H "Content-Type: application/json"

# With pretty print
curl -s -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production" \
  -H "Content-Type: application/json" | jq '.data | {status, chunksCreated, embeddingsGenerated, duration}'
```

#### Unauthorized Request (Error)

```bash
# Missing authorization header
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Content-Type: application/json"

# Invalid token
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json"
```

Expected Error:
```json
{
  "status": "error",
  "error": "UNAUTHORIZED",
  "message": "Invalid or missing admin token"
}
```

## Browser Testing

### 1. Home Page

```
http://localhost:3000
```

### 2. Chat Interface

```
http://localhost:3000/chat
```

Features to test:
- Type messages in the input field
- Click "Send" button
- Verify responses with citations
- Click on citation links
- Clear conversation button
- Error handling

### 3. Prisma Studio

```bash
npx prisma studio
```

Access at: `http://localhost:5555`

Features to test:
- View pages table
- View chunks table
- View admin_logs table
- Check embedding values stored

### 4. pgAdmin

Access at: `http://localhost:5050`

Credentials:
- Email: admin@example.com
- Password: admin

## Load Testing

### Simple Load Test

```bash
# Send 10 requests in parallel
for i in {1..10}; do
  (curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"test query $i\"}" &)
done
wait
```

### Rate Limiting Test

```bash
# Send 15 requests rapidly (should be rate limited after 10)
for i in {1..15}; do
  curl -s http://localhost:3000/api/chat \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}'
  echo "Request $i"
done
```

## Performance Testing

### Measure Response Time

```bash
# Time a chat request
time curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the 401k matching?"}'

# Measure 5 requests
for i in {1..5}; do
  echo "Request $i:"
  time curl -s -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message":"test query"}' > /dev/null
done
```

## Database Testing

### Check Data in Database

```bash
# Connect to database
psql postgresql://postgres:postgres@localhost:5432/aexp_benefits

# SQL queries
SELECT COUNT(*) FROM pages;
SELECT COUNT(*) FROM chunks;
SELECT COUNT(*) FROM admin_logs;
```

### Query via Prisma CLI

```bash
# Use Prisma to inspect data
npx prisma client

# Example queries in Node.js REPL
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Get all pages
await prisma.page.findMany()

// Get chunks
await prisma.chunk.findMany({ take: 5 })

// Get admin logs
await prisma.adminLog.findMany({ orderBy: { createdAt: 'desc' } })
```

## Debugging

### Enable Verbose Logging

```bash
# Run dev server with debug logs
DEBUG=* yarn dev

# Run curl with verbose output
curl -v -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Check Server Logs

```bash
# View docker logs
docker-compose logs postgres
docker-compose logs -f postgres  # Follow logs

# View running processes
lsof -i :3000  # Next.js
lsof -i :5432  # PostgreSQL
```

### Test Environment Variables

```bash
# Verify env file is loaded
cat .env

# Check if OPENAI_API_KEY is set
echo $OPENAI_API_KEY

# Verify DATABASE_URL
echo $DATABASE_URL
```

## Common Issues & Solutions

### Issue: "Cannot connect to database"
```bash
# Check if PostgreSQL is running
docker-compose ps

# Start if not running
docker-compose up -d

# Check port 5432 is accessible
nc -zv localhost 5432
```

### Issue: "Invalid or missing admin token"
```bash
# Verify token matches .env file
grep ADMIN_TOKEN .env

# Use correct token in request
curl -H "Authorization: Bearer dev-admin-token-change-in-production" ...
```

### Issue: "OPENAI_API_KEY not set"
```bash
# Check if key is in .env
grep OPENAI_API_KEY .env

# If not set, add to .env
echo 'OPENAI_API_KEY="sk-..."' >> .env

# Restart dev server
# Kill: Ctrl+C
# Restart: yarn dev
```

### Issue: "Too many requests"
```bash
# Rate limit is 10 requests per minute
# Wait 60 seconds before making more requests

# Or test with longer delays
for i in {1..3}; do
  curl -s http://localhost:3000/api/chat \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"message":"test"}'
  sleep 20  # Wait 20 seconds between requests
done
```

## Test Checklist

- [ ] PostgreSQL running (docker-compose ps)
- [ ] Next.js server running (lsof -i :3000)
- [ ] Chat API responding (GET /api/chat)
- [ ] Chat API accepts messages (POST /api/chat)
- [ ] Admin status endpoint working (GET /api/admin/status)
- [ ] Admin reindex endpoint working (POST /api/admin/reindex)
- [ ] Citations are generated with responses
- [ ] Error handling for invalid input
- [ ] Rate limiting working
- [ ] Database contains indexed data
- [ ] Prisma Studio accessible
- [ ] Chat page loads in browser
- [ ] Chat UI can send and receive messages

## Continuous Testing

### Watch Mode for Development

```bash
# Watch TypeScript files for changes (if using ts-node elsewhere)
yarn dev  # Next.js watches automatically

# Watch database for changes
npx prisma studio
```

### Integration Test Loop

```bash
# Run through all test scenarios
echo "1. Testing chat API..."
curl -s http://localhost:3000/api/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}' | jq '.status'

echo "2. Testing admin status..."
curl -s http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production" | jq '.status'

echo "3. Checking database..."
psql postgresql://postgres:postgres@localhost:5432/aexp_benefits \
  -c "SELECT COUNT(*) as chunk_count FROM chunks;"

echo "✓ All systems operational"
```

## See Also

- [API.md](./API.md) - Complete API documentation
- [DATABASE.md](./DATABASE.md) - Database schema and queries
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment guide
