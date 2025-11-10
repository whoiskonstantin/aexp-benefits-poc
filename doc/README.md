# Documentation

Complete documentation for the AmEx Benefits Chat POC.

## 📚 Start Here

**New to this project?** Start with [INDEX.md](./INDEX.md) - it explains all documentation and guides you based on your role.

## Quick Navigation

| Document | Purpose |
|----------|---------|
| [INDEX.md](./INDEX.md) | **Start here** - Documentation overview and navigation guide |
| [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md) | Current project status and what's been completed |
| [TESTING.md](./TESTING.md) | Testing guide with curl commands and API testing examples |
| [API.md](./API.md) | Complete API endpoint documentation |
| [FEATURES.md](./FEATURES.md) | Detailed feature descriptions and requirements |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and architecture overview |
| [DATABASE.md](./DATABASE.md) | Database schema, Prisma setup, and configuration |
| [ROADMAP.md](./ROADMAP.md) | Development phases and timeline |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker setup, deployment options, and infrastructure |

## Quick Start

```bash
# Start services
docker-compose up -d
yarn dev

# Test API
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the HSA contribution limit?"}'

# View more test commands
cat doc/TESTING.md
```

## Key Resources

### For Testing
- Full testing guide: [TESTING.md](./TESTING.md)
- API endpoints: [API.md](./API.md)

### For Development
- System design: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Development plan: [ROADMAP.md](./ROADMAP.md)
- Database setup: [DATABASE.md](./DATABASE.md)

### For Deployment
- Infrastructure guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Feature requirements: [FEATURES.md](./FEATURES.md)

## Project Status

✅ **Phase 1-3 Complete**: Database, Scraper, Search, and LLM Integration
🚧 **Phase 4-6 Pending**: Polish, Testing, and Deployment

See [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md) for detailed status.

## Documentation Structure

```
doc/
├── README.md                    (this file)
├── INDEX.md                     (navigation guide)
├── IMPLEMENTATION_PROGRESS.md   (status and what's done)
├── TESTING.md                   (testing procedures & curl commands)
├── API.md                       (endpoint documentation)
├── FEATURES.md                  (feature requirements)
├── ARCHITECTURE.md              (system design)
├── DATABASE.md                  (database & schema)
├── ROADMAP.md                   (development timeline)
└── DEPLOYMENT.md                (infrastructure & deployment)
```

## By Use Case

### I want to...

**Test the API**
→ Go to [TESTING.md](./TESTING.md)

**Understand how it works**
→ Go to [ARCHITECTURE.md](./ARCHITECTURE.md)

**Deploy to production**
→ Go to [DEPLOYMENT.md](./DEPLOYMENT.md)

**See what endpoints are available**
→ Go to [API.md](./API.md)

**Understand the current status**
→ Go to [IMPLEMENTATION_PROGRESS.md](./IMPLEMENTATION_PROGRESS.md)

**Plan next steps**
→ Go to [ROADMAP.md](./ROADMAP.md)

**Set up development environment**
→ Go to [DATABASE.md](./DATABASE.md) and [DEPLOYMENT.md](./DEPLOYMENT.md)

## Common curl Commands

### Chat API
```bash
# Ask a question
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the HSA contribution limit?"}'
```

### Admin Endpoints
```bash
# Check status
curl http://localhost:3000/api/admin/status \
  -H "Authorization: Bearer dev-admin-token-change-in-production"

# Trigger re-indexing
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production"
```

See [TESTING.md](./TESTING.md) for more examples.

## Questions?

1. **Search the docs** - Use the index in [INDEX.md](./INDEX.md)
2. **Check testing procedures** - See [TESTING.md](./TESTING.md)
3. **Review API documentation** - See [API.md](./API.md)
4. **Understand the architecture** - See [ARCHITECTURE.md](./ARCHITECTURE.md)

---

Last Updated: 2025-11-10
Status: Production Ready for Phase 3
