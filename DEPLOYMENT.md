# DEPLOYMENT.md

Docker setup, local development, and production deployment guide.

## Docker & Local Development

### Prerequisites

- Docker Desktop installed (https://www.docker.com/products/docker-desktop)
- Docker Compose (included with Docker Desktop)
- Node.js 20+
- Yarn package manager

### Docker Compose Setup

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: aexp-benefits-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: aexp_benefits
      POSTGRES_INITDB_ARGS: "--encoding=UTF8"
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - aexp-network

  # Optional: pgAdmin for database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: aexp-benefits-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    networks:
      - aexp-network

volumes:
  postgres-data:
    driver: local

networks:
  aexp-network:
    driver: bridge
```

### Database Initialization Script

Create `init-db.sql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (Prisma will handle this with migrations)
-- This script just ensures pgvector is available
```

### Starting Local Development

```bash
# Start PostgreSQL and pgAdmin
docker-compose up -d

# Verify containers are running
docker-compose ps

# View logs
docker-compose logs -f postgres

# Stop containers
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v
```

### Setting Up Environment

1. **Create `.env.local`**:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aexp_benefits"

# OpenAI
OPENAI_API_KEY="sk-your-key-here"

# AmEx
AMEX_BENEFITS_URL="https://www.aexp.com/benefits"

# Admin
ADMIN_TOKEN="dev-admin-token"

# App
NODE_ENV="development"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

2. **Install dependencies**:
```bash
yarn install
```

3. **Run database migrations**:
```bash
npx prisma migrate dev --name init
```

4. **Start development server**:
```bash
yarn dev
```

5. **Access the application**:
- Chat: http://localhost:3000/chat
- Prisma Studio: `npx prisma studio` → http://localhost:5555
- pgAdmin: http://localhost:5050 (admin@example.com / admin)

---

## Local Development Workflow

### Daily Development

```bash
# Start services (if not already running)
docker-compose up -d

# Start Next.js dev server
yarn dev

# In another terminal, open Prisma Studio for database inspection
npx prisma studio
```

### Database Operations

```bash
# View current state
npx prisma studio

# Create a new migration after schema changes
npx prisma migrate dev --name <migration_name>

# Reset database (development only)
npx prisma migrate reset

# Seed database with test data (optional)
node scripts/seed.ts
```

### Debugging

```bash
# View database logs
docker-compose logs postgres

# Connect directly to database
psql postgresql://postgres:postgres@localhost:5432/aexp_benefits

# SQL query to test vector search
SELECT id, text, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM chunks
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

---

## Production Deployment

### Docker Image Build

Create `Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js app
RUN yarn build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy built app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy Prisma client
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start app
CMD ["node_modules/.bin/next", "start"]
```

### Build and Test Docker Image Locally

```bash
# Build image
docker build -t aexp-benefits:latest .

# Run image locally
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e OPENAI_API_KEY="sk-..." \
  -e ADMIN_TOKEN="token" \
  aexp-benefits:latest

# Test endpoint
curl http://localhost:3000/api/chat
```

### Docker Compose for Production

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - aexp-network
    # Add backup job
    command: >
      postgres
      -c wal_level=replica
      -c archive_mode=on
      -c archive_command='/bin/true'

  app:
    image: aexp-benefits:latest
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      AMEX_BENEFITS_URL: ${AMEX_BENEFITS_URL}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - aexp-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres-data:

networks:
  aexp-network:
```

### Deployment to Vercel

Vercel is the easiest option for Next.js apps:

1. **Connect repository**:
   - Push code to GitHub
   - Visit vercel.com and connect repository

2. **Configure environment variables**:
   ```
   DATABASE_URL = postgresql://...
   OPENAI_API_KEY = sk-...
   ADMIN_TOKEN = ...
   ```

3. **Configure database**:
   - Use Vercel Postgres (managed PostgreSQL)
   - Or connect external PostgreSQL (e.g., AWS RDS, Railway)

4. **Deploy**:
   ```bash
   # Deploy from CLI
   yarn install -g vercel
   vercel

   # Or push to main branch for auto-deploy
   git push origin main
   ```

### Deployment to AWS

**Option 1: EC2 + RDS**

1. Create EC2 instance (Ubuntu 22.04, t3.medium)
2. Create RDS PostgreSQL instance (15.4)
3. Enable pgvector on RDS:
   ```sql
   CREATE EXTENSION vector;
   ```
4. SSH into EC2 and deploy:
   ```bash
   git clone <repo>
   cd aexp-benefits-poc

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install Yarn
   npm install -g yarn

   # Install PM2 for process management
   npm install -g pm2

   # Setup
   yarn install
   npx prisma migrate deploy

   # Start app with PM2
   pm2 start "yarn start" --name aexp-benefits
   pm2 save
   pm2 startup
   ```

5. Configure nginx as reverse proxy:
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

**Option 2: ECS + RDS**

1. Create RDS PostgreSQL instance
2. Create ECR repository
3. Push Docker image to ECR
4. Create ECS task definition
5. Create ECS service
6. Configure load balancer
7. Set up auto-scaling

**Option 3: Lambda + RDS**

For serverless, use AWS Lambda with Next.js adapter:

```bash
# Add adapter
yarn add -D @vendia/serverless-express

# Build with serverless framework
serverless deploy
```

### Deployment to Railway

Simple option for managed PostgreSQL + Node.js:

1. Connect GitHub repository
2. Railway auto-detects Next.js
3. Configure PostgreSQL plugin
4. Set environment variables
5. Auto-deploys on push

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway up
```

---

## Environment Variables

### Development
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aexp_benefits"
OPENAI_API_KEY="sk-test-key"
AMEX_BENEFITS_URL="https://www.aexp.com/benefits"
ADMIN_TOKEN="dev-token"
NODE_ENV="development"
```

### Production
```env
DATABASE_URL="postgresql://user:password@prod-db.example.com/aexp_benefits"
OPENAI_API_KEY="sk-prod-key"
AMEX_BENEFITS_URL="https://www.aexp.com/benefits"
ADMIN_TOKEN="secure-random-token"
NODE_ENV="production"
NEXT_PUBLIC_API_URL="https://benefits.example.com"
```

### Security Notes
- Never commit `.env*` files to git
- Use separate tokens for dev/prod
- Rotate `ADMIN_TOKEN` regularly
- Use managed secrets (Vercel Secrets, AWS Secrets Manager)
- Ensure DATABASE_URL doesn't contain credentials in logs

---

## Database Backups

### Manual Backup

```bash
# Backup to file
docker-compose exec postgres pg_dump -U postgres aexp_benefits > backup.sql

# Backup with compression
docker-compose exec postgres pg_dump -U postgres -Fc aexp_benefits > backup.dump

# Restore from backup
docker-compose exec -T postgres psql -U postgres aexp_benefits < backup.sql
```

### Automated Backups (AWS)

Use AWS Backup for RDS:
1. Enable automated backups (retention: 30 days)
2. Enable backup snapshots
3. Configure cross-region replication

### Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.dump"

mkdir -p $BACKUP_DIR

echo "Starting backup..."
docker-compose exec -T postgres pg_dump -U postgres -Fc aexp_benefits > $BACKUP_FILE

echo "Backup completed: $BACKUP_FILE"

# Keep only last 7 backups
find $BACKUP_DIR -name "backup_*.dump" -mtime +7 -delete
```

---

## Monitoring & Health Checks

### Health Check Endpoint

Create `app/api/health/route.ts`:

```typescript
export async function GET() {
  try {
    const db = await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', db: 'connected' })
  } catch (error) {
    return Response.json(
      { status: 'error', db: 'disconnected' },
      { status: 503 }
    )
  }
}
```

### Monitoring Tools

1. **Vercel Analytics** - Performance monitoring
2. **Datadog** - Application monitoring
3. **New Relic** - APM and infrastructure
4. **Sentry** - Error tracking

Example Sentry integration:

```typescript
// lib/sentry.ts
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### Alerts

Configure alerts for:
- Database connection errors
- API response time > 5s
- Error rate > 1%
- 503 errors from OpenAI API
- Disk space usage > 80%

---

## Performance Optimization

### Caching

```typescript
// Cache /api/admin/status for 1 minute
res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120')
```

### Database Connection Pooling

Using PgBouncer:

```yaml
# docker-compose.yml
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_USER: postgres
    DATABASES_PASSWORD: postgres
    DATABASES_DBNAME: aexp_benefits
  ports:
    - "6432:6432"
  depends_on:
    - postgres
```

Update DATABASE_URL to use PgBouncer:
```
DATABASE_URL="postgresql://user:password@pgbouncer:6432/aexp_benefits"
```

### CDN for Static Assets

```typescript
// next.config.ts
export default {
  images: {
    domains: ['cdn.example.com'],
  },
}
```

---

## Rollback & Disaster Recovery

### Database Rollback

```bash
# Rollback to previous migration
npx prisma migrate resolve --rolled-back <migration_name>

# Restore from backup
psql postgresql://... < backup.sql
```

### Application Rollback

With Vercel: Click "Rollback" in deployment history

With Docker: Redeploy previous image version

---

## Checklist for Production Deployment

- [ ] Environment variables configured securely
- [ ] Database credentials rotated
- [ ] Admin token randomized and stored securely
- [ ] HTTPS/SSL enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Error tracking (Sentry) configured
- [ ] Monitoring and alerts set up
- [ ] Database backups automated
- [ ] Disaster recovery plan documented
- [ ] Load balancer configured
- [ ] Auto-scaling configured
- [ ] CDN configured for static assets
- [ ] Logs aggregated and retained
- [ ] Performance baseline established
- [ ] Security audit completed

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql postgresql://user:password@localhost:5432/aexp_benefits

# View Postgres logs
docker-compose logs postgres

# Check if port 5432 is in use
lsof -i :5432
```

### High Memory Usage

```bash
# Check Node.js memory
docker stats

# Increase memory limit in docker-compose.yml
# Add: mem_limit: 2g
```

### Slow Database Queries

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design.
See [DATABASE.md](./DATABASE.md) for schema details.
See [API.md](./API.md) for endpoint documentation.
