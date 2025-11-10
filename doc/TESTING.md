# TESTING.md

Quick testing guide for AmEx Benefits Chat API.

## Quick Start

```bash
# Start services
docker-compose up -d
yarn dev

# View database (optional)
npx prisma studio  # http://localhost:5555
```

## Essential Commands

### 1. Re-index Content (Run Scraper)

```bash
# Crawl benefits pages, chunk content, generate embeddings, index in database
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production" \
  -H "Content-Type: application/json" | jq .
```

### 2. Chat API

```bash
# Ask a question
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the HSA contribution limit?"}'

# With pretty print
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the HSA contribution limit?"}' | jq .
```

### 3. Check Status

```bash
# System and indexing status
curl -s http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production" | jq .
```

### 4. Database

```bash
# View pages, chunks, logs
npx prisma studio

# Check counts
psql postgresql://postgres:postgres@localhost:5432/aexp_benefits -c "SELECT COUNT(*) FROM pages; SELECT COUNT(*) FROM chunks;"
```

## Browser Testing

- Home: `http://localhost:3000`
- Chat: `http://localhost:3000/chat`
- Prisma Studio: `http://localhost:5555`
- pgAdmin: `http://localhost:5050` (admin@example.com / admin)

## Troubleshooting

```bash
# Check services running
docker-compose ps
lsof -i :3000
lsof -i :5432

# View logs
docker-compose logs postgres
```

## See Also

- [API.md](./API.md) - Complete API documentation
- [DATABASE.md](./DATABASE.md) - Database schema
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
