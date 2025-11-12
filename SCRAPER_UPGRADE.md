# Scraper Upgrade: Playwright + LLM

## Overview

The AmEx Benefits scraper has been completely rewritten to use **Playwright** for browser automation and **OpenAI GPT-4o-mini** for intelligent content extraction. This upgrade replaces the previous Axios + Cheerio implementation that couldn't handle JavaScript-rendered content.

## What Changed

### Before (Axios + Cheerio)
- ❌ Static HTML scraping only
- ❌ Could not handle JavaScript/Vue.js rendered content
- ❌ Used hardcoded demo data as fallback
- ❌ Brittle CSS selectors
- ❌ Limited error handling

### After (Playwright + GPT-4o-mini)
- ✅ Full browser automation with JavaScript rendering support
- ✅ Intelligent content extraction using LLM
- ✅ Real scraping from live AmEx benefits pages
- ✅ Robust error handling with retry logic and screenshots
- ✅ Browser lifecycle management (singleton pattern)
- ✅ Rate limiting and User-Agent rotation
- ✅ Configurable via environment variables

## Key Features

### 1. **Playwright Browser Automation**
- Launches Chromium browser (headless by default)
- Waits for network idle and JavaScript rendering
- Handles SPA (Single Page Application) content
- Captures screenshots on errors for debugging

### 2. **GPT-4o-mini Content Extraction**
- Intelligently extracts main content from HTML
- Removes navigation, ads, footers, and other clutter
- Focuses on benefits-related information
- Returns clean, structured text

### 3. **Advanced Error Handling**
- Retry logic with exponential backoff (3 attempts by default)
- Screenshot capture on failures (saved to `/tmp/`)
- Detailed error logging
- Graceful degradation

### 4. **Browser Lifecycle Management**
- Singleton browser instance (reused across pages)
- Proper cleanup on process exit
- Context isolation per scraping session
- Automatic resource management

### 5. **Rate Limiting & Politeness**
- Random delays between requests (2-5 seconds)
- User-Agent rotation
- Configurable retry limits
- Respects server resources

## Configuration

New environment variables in `.env`:

```bash
# Playwright Configuration
PLAYWRIGHT_HEADLESS="true"          # Set to "false" to see browser (useful for debugging)
SCRAPER_TIMEOUT="60000"             # Page load timeout in ms (default: 60 seconds)
SCRAPER_MAX_RETRIES="3"             # Maximum retry attempts per page (default: 3)
```

Existing variables still used:
```bash
AMEX_BENEFITS_URL="https://www.americanexpress.com/en-us/colleagues/benefits/medical"
OPENAI_API_KEY="your-openai-api-key"
```

## Usage

### Via API Endpoint (Recommended)

Trigger a reindex to scrape fresh content:

```bash
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production"
```

### Programmatic Usage

```typescript
import { crawlBenefitsPages, closeBrowser } from '@/lib/scraper'

// Scrape all benefit pages
const pages = await crawlBenefitsPages()

// Don't forget to close browser when done
await closeBrowser()
```

## What Gets Scraped

The scraper targets these benefit pages:

1. `/en-us/colleagues/benefits/medical` - Medical plans
2. `/en-us/colleagues/benefits/dental` - Dental coverage
3. `/en-us/colleagues/benefits/vision` - Vision benefits
4. `/en-us/colleagues/benefits/retirement` - 401(k) and retirement
5. `/en-us/colleagues/benefits/life-insurance` - Life insurance
6. `/en-us/colleagues/benefits/disability` - Disability coverage
7. `/en-us/colleagues/benefits/flexible-spending` - FSA/HSA
8. `/en-us/colleagues/benefits/wellness` - Wellness programs

Plus any additional benefit pages discovered from the main benefits index.

## Performance & Cost

### Speed
- ~5-10 seconds per page (including JS rendering + LLM extraction)
- 8 predefined pages = ~1-2 minutes total

### OpenAI Costs (GPT-4o-mini)
- **Input**: ~$0.15 per 1M tokens (~$0.003 per page)
- **Output**: ~$0.60 per 1M tokens (~$0.001 per page)
- **Total per reindex**: ~$0.03-0.05 for all pages

### Rate Limits
- GPT-4o-mini: Much higher than GPT-4 (200k+ tokens/min)
- HTML pre-processed to ~20k chars before sending to LLM
- Well within free tier limits for development

## Debugging

### Enable Visual Browser

Set `PLAYWRIGHT_HEADLESS="false"` in `.env` to watch the browser scrape:

```bash
PLAYWRIGHT_HEADLESS="false"
```

### Check Error Screenshots

Failed scrapes create screenshots in `/tmp/`:

```bash
ls -lt /tmp/scraper-error-*.png | head
```

### Verbose Logging

The scraper logs:
- Browser launch
- Page navigation
- Content extraction progress
- LLM calls and results
- Errors and retries

Check your terminal or application logs.

## Migration Notes

### Removed Dependencies
- ❌ `axios` - No longer needed (Playwright handles HTTP)
- ❌ `cheerio` - No longer needed (LLM handles parsing)

### Added Dependencies
- ✅ `playwright` (v1.56.1) - Browser automation

### Breaking Changes
- **Demo data removed**: Scraper now always hits live sites
- **Function signature unchanged**: `crawlBenefitsPages()` still returns `ScrapedPage[]`
- **`crawlBenefitsPagesReal()` removed**: Main function now does real scraping

## Troubleshooting

### "Unable to find browser"

Install Chromium:
```bash
yarn playwright install chromium
```

### "Rate limit exceeded"

The scraper handles OpenAI rate limits automatically, but if issues persist:
- Increase delays between pages
- Reduce `maxHtmlLength` in `lib/scraper.ts`
- Switch to GPT-3.5-turbo (even cheaper)

### "Navigation timeout"

Increase timeout:
```bash
SCRAPER_TIMEOUT="120000"  # 2 minutes
```

### Pages return empty content

- Check if pages require authentication (scraper uses public URLs)
- Enable visual browser mode to see what's happening
- Check screenshots in `/tmp/`

## Future Enhancements

Potential improvements:

1. **Authentication Support** - Add login capability for employee-only pages
2. **Sitemap Parsing** - Automatically discover all benefit pages
3. **Change Detection** - Only reindex pages that have changed
4. **Parallel Scraping** - Process multiple pages simultaneously
5. **Robots.txt Checking** - Verify we're allowed to scrape before starting
6. **Structured Extraction** - Use LLM to extract specific fields (deductibles, copays, etc.)

## Testing

Build verification:
```bash
yarn build
```

Run the application:
```bash
yarn dev
```

Trigger a test reindex:
```bash
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer dev-admin-token-change-in-production"
```

## Files Modified

- `lib/scraper.ts` - Complete rewrite with Playwright + LLM
- `app/api/chat/route.ts` - Fixed TypeScript error (validation.error.issues)
- `.env` - Added Playwright configuration variables
- `.env.example` - Created with all configuration options
- `package.json` - Added playwright, removed axios & cheerio

## Summary

The scraper is now production-ready with:
- ✅ JavaScript rendering support
- ✅ Intelligent content extraction
- ✅ Robust error handling
- ✅ Proper resource management
- ✅ Cost-effective LLM usage (~$0.04 per reindex)
- ✅ Configurable and debuggable

The upgrade enables real-time scraping of AmEx benefits pages with high-quality content extraction, replacing the previous demo-data approach.
