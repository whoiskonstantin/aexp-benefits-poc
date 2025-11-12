# Admin Page & Intelligent Navigation

## Overview

The AmEx Benefits POC now includes a full-featured admin dashboard with localStorage-based authentication and intelligent site navigation tracking. The scraper has been enhanced to intelligently discover and navigate through benefit pages using Breadth-First Search (BFS), with all navigation steps saved to the database and displayed in the admin UI.

## What's New

### 1. **Admin Dashboard** (`/admin`)

A complete admin interface for managing content reindexing with:
- **localStorage Authentication** - Store admin token in browser
- **Reindex Trigger** - Button to start crawling with live status
- **Crawl History** - View all past crawl sessions
- **Navigation Steps Viewer** - Inspect the exact path taken during each crawl
- **Real-time Status** - See pages scraped, chunks created, embeddings generated

### 2. **Intelligent Site Navigation**

The scraper now intelligently discovers pages instead of using hardcoded URLs:

**Before:**
```typescript
// Hardcoded list of pages
const BENEFIT_PAGE_PATHS = [
  '/en-us/colleagues/benefits/medical',
  '/en-us/colleagues/benefits/dental',
  // ... etc
]
```

**After:**
```typescript
// BFS algorithm discovers pages dynamically
- Starts from base URL
- Extracts all benefit-related links
- Follows links up to MAX_PAGES_TO_CRAWL (default: 20)
- Tracks parent-child relationships
- Saves complete navigation history
```

### 3. **Navigation Tracking Database**

New Prisma models for tracking crawl sessions:

**CrawlSession:**
- Tracks each reindex operation
- Records start/end times, status, pages scraped
- Links to all navigation steps

**NavigationStep:**
- Every page visited during a crawl
- URL, depth, parent URL, link text
- Whether page was successfully scraped
- Timestamp of visit

## How to Use

### Setting Up Admin Access

**Method 1: Via Admin Page**
1. Visit `http://localhost:3000/admin`
2. Enter your admin token (default: `dev-admin-token-change-in-production`)
3. Click "Save Token"

**Method 2: Via Browser Console**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
   ```javascript
   localStorage.setItem('adminToken', 'dev-admin-token-change-in-production')
   ```
4. Refresh the page

**Method 3: Environment Variable**
The admin token is configured in `.env`:
```bash
ADMIN_TOKEN="dev-admin-token-change-in-production"
```

Change this in production!

### Triggering a Reindex

1. Navigate to `/admin`
2. Authenticate with admin token
3. Click "Start Reindex" button
4. Watch real-time progress (can take 1-2 minutes)
5. View results: pages scraped, chunks created, navigation steps

**What Happens During Reindex:**
1. Creates a new CrawlSession in database
2. Launches Playwright browser
3. Starts from `AMEX_BENEFITS_URL`
4. Discovers benefit-related links on page
5. Uses BFS to navigate through site (up to 20 pages)
6. Scrapes each page with GPT-4o-mini
7. Saves navigation steps to database
8. Chunks content and generates embeddings
9. Updates database with new content
10. Marks crawl session as completed

### Viewing Navigation Steps

After a reindex completes:

1. Go to "Crawl History" section
2. Click "View Steps" for any session
3. See detailed navigation path:
   - Each URL visited
   - Depth level (distance from start)
   - Parent URL (which page linked to this)
   - Link text (what the link said)
   - Whether scraping succeeded
   - Timestamp of visit

**Example Navigation Flow:**
```
Step 1 • Depth 0 • Scraped ✓
https://www.americanexpress.com/en-us/colleagues/benefits
From: (start)

Step 2 • Depth 1 • Scraped ✓
https://www.americanexpress.com/en-us/colleagues/benefits/medical
From: https://www.americanexpress.com/en-us/colleagues/benefits
Link text: "Medical Benefits"

Step 3 • Depth 1 • Scraped ✓
https://www.americanexpress.com/en-us/colleagues/benefits/dental
From: https://www.americanexpress.com/en-us/colleagues/benefits
Link text: "Dental Coverage"
```

## API Endpoints

### 1. POST `/api/admin/reindex`
Trigger content reindexing.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "jobId": "reindex-1699999999999",
    "pagesCrawled": 15,
    "chunksCreated": 45,
    "embeddingsGenerated": 45,
    "duration": 120000,
    "crawlSessionId": 1,
    "navigationSteps": 20,
    "status": "success"
  }
}
```

### 2. GET `/api/admin/crawl-sessions`
Fetch all crawl sessions (last 50).

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "sessions": [
      {
        "id": 1,
        "startedAt": "2025-11-12T00:00:00.000Z",
        "completedAt": "2025-11-12T00:02:00.000Z",
        "status": "completed",
        "pagesScraped": 15,
        "navigationStepsCount": 20,
        "duration": 120000
      }
    ]
  }
}
```

### 3. GET `/api/admin/navigation/:sessionId`
Fetch navigation steps for a specific crawl session.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "session": {
      "id": 1,
      "startedAt": "2025-11-12T00:00:00.000Z",
      "completedAt": "2025-11-12T00:02:00.000Z",
      "status": "completed",
      "pagesScraped": 15
    },
    "navigationSteps": [
      {
        "id": 1,
        "url": "https://www.americanexpress.com/en-us/colleagues/benefits",
        "depth": 0,
        "parentUrl": null,
        "linkText": null,
        "visitedAt": "2025-11-12T00:00:00.000Z",
        "scraped": true
      }
    ]
  }
}
```

## Configuration

### Environment Variables

**`.env`:**
```bash
# Admin authentication
ADMIN_TOKEN="dev-admin-token-change-in-production"

# Scraper configuration
AMEX_BENEFITS_URL="https://www.americanexpress.com/en-us/colleagues/benefits/medical"
MAX_PAGES_TO_CRAWL="20"              # Limit to 20 pages per crawl
PLAYWRIGHT_HEADLESS="true"           # Set to "false" to watch browser
SCRAPER_TIMEOUT="60000"              # 60 seconds per page
SCRAPER_MAX_RETRIES="3"              # Retry failed pages 3 times
```

### Intelligent Navigation Settings

The scraper intelligently filters links to only follow benefit-related pages:

**✅ Will Crawl:**
- Same domain as base URL
- Path contains "benefits" or "colleagues"
- HTML pages (not PDFs, images, etc.)

**❌ Will Skip:**
- Different domains
- Non-benefit pages (e.g., `/careers`, `/about`)
- Binary files (.pdf, .jpg, .png, .zip, etc.)
- Already visited URLs (deduplication)

### BFS Algorithm

The scraper uses Breadth-First Search to systematically explore the site:

```
Depth 0: Start URL
         └─> Discover 10 links

Depth 1: Visit link 1
         └─> Discover 5 more links
         Visit link 2
         └─> Discover 3 more links
         ...

Depth 2: Visit newly discovered links
         └─> Continue until MAX_PAGES_TO_CRAWL reached
```

**Benefits of BFS:**
- Explores pages closest to start URL first
- Better coverage of high-level pages
- Natural stopping point when limit reached
- Parent-child relationships preserved

## Database Schema

### CrawlSession Table
```sql
CREATE TABLE crawl_sessions (
  id              SERIAL PRIMARY KEY,
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP,
  status          VARCHAR(20),  -- 'in_progress', 'completed', 'failed'
  pages_scraped   INTEGER DEFAULT 0
);
```

### NavigationStep Table
```sql
CREATE TABLE navigation_steps (
  id               SERIAL PRIMARY KEY,
  crawl_session_id INTEGER REFERENCES crawl_sessions(id),
  url              VARCHAR(2048),
  depth            INTEGER,
  parent_url       VARCHAR(2048),
  link_text        VARCHAR(255),
  visited_at       TIMESTAMP DEFAULT NOW(),
  scraped          BOOLEAN DEFAULT false
);
```

## Performance

### Crawl Times
- **8-15 pages**: ~1-2 minutes
- **20 pages** (max): ~2-3 minutes
- Rate limited: 2-5 seconds between pages
- Includes JS rendering + LLM extraction

### Costs (GPT-4o-mini)
- **Per page**: ~$0.004
- **20 pages**: ~$0.08
- **Monthly** (daily reindex): ~$2.40

### Storage
- **NavigationStep**: ~500 bytes per record
- **20 steps**: ~10 KB per crawl session
- Negligible database impact

## Troubleshooting

### "UNAUTHORIZED" Error
**Problem:** Admin token not valid
**Solution:** Check your token matches `ADMIN_TOKEN` in `.env`

```bash
# Verify token
cat .env | grep ADMIN_TOKEN

# Set in localStorage
localStorage.setItem('adminToken', 'your-actual-token')
```

### "SESSION_NOT_FOUND" Error
**Problem:** Trying to view navigation steps for non-existent session
**Solution:** Check crawl sessions list, ensure session ID exists

### Reindex Takes Too Long
**Problem:** Crawl exceeds expected time
**Solution:** Reduce `MAX_PAGES_TO_CRAWL`

```bash
MAX_PAGES_TO_CRAWL="10"  # Crawl only 10 pages
```

### No Pages Scraped
**Problem:** Scraper finds no content
**Solution:**
1. Check `AMEX_BENEFITS_URL` is valid
2. Enable visual mode: `PLAYWRIGHT_HEADLESS="false"`
3. Check browser screenshots in `/tmp/`

### Navigation Steps Not Saving
**Problem:** Reindex succeeds but no navigation history
**Solution:** Run migration:

```bash
npx prisma migrate deploy
```

## Security Notes

### Admin Token Storage
- **localStorage**: Persists across sessions
- **Not encrypted**: Anyone with browser access can read
- **HTTPS recommended**: Always use HTTPS in production
- **Token rotation**: Change `ADMIN_TOKEN` regularly

### Production Checklist
- ✅ Change `ADMIN_TOKEN` from default
- ✅ Use strong, random token (32+ characters)
- ✅ Enable HTTPS
- ✅ Consider IP whitelisting for `/admin`
- ✅ Implement rate limiting on admin endpoints
- ✅ Monitor for unauthorized access attempts

## Files Modified

### New Files
- `app/admin/page.tsx` - Admin dashboard UI
- `app/api/admin/crawl-sessions/route.ts` - Crawl history API
- `app/api/admin/navigation/[sessionId]/route.ts` - Navigation steps API
- `prisma/migrations/20251112001700_add_navigation_tracking/` - Database migration

### Modified Files
- `lib/scraper.ts` - Intelligent BFS navigation
- `lib/indexer.ts` - Save navigation steps to DB
- `app/api/admin/reindex/route.ts` - Return navigation data
- `prisma/schema.prisma` - Add CrawlSession & NavigationStep models
- `.env` - Add MAX_PAGES_TO_CRAWL
- `.env.example` - Document new variables

## Next Steps

### Suggested Enhancements

1. **Authentication Upgrade**
   - Add proper login system
   - JWT tokens instead of localStorage
   - Role-based access control

2. **Real-time Progress**
   - WebSocket updates during crawl
   - Live progress bar
   - Cancel ongoing crawls

3. **Advanced Navigation**
   - Sitemap.xml parsing
   - Configurable crawl rules
   - Domain/path whitelist/blacklist

4. **Visualization**
   - Navigation graph (D3.js)
   - Tree view of page hierarchy
   - Depth-based coloring

5. **Monitoring**
   - Crawl success rate metrics
   - Average depth distribution
   - Failed page reports

6. **Scheduling**
   - Cron-based reindexing
   - Configurable intervals
   - Email notifications

## Summary

The admin dashboard provides complete visibility into the crawling process with:

✅ **localStorage-based authentication** - Quick setup, no backend auth needed
✅ **Intelligent BFS navigation** - Discovers pages dynamically
✅ **Complete navigation tracking** - Every step saved to database
✅ **Beautiful UI** - View crawl history and navigation paths
✅ **Limit to 20 pages** - Configurable via `MAX_PAGES_TO_CRAWL`
✅ **Real-time feedback** - See results immediately after reindex

Visit `/admin` to get started!
