import { chromium, Browser, Page, BrowserContext } from 'playwright'
import { OpenAI } from 'openai'

export interface ScrapedPage {
  url: string
  title: string
  content: string
  headings: string[]
}

export interface NavigationStep {
  url: string
  depth: number
  parentUrl: string | null
  linkText: string | null
  visitedAt: Date
  scraped: boolean
}

export interface CrawlResult {
  pages: ScrapedPage[]
  navigationSteps: NavigationStep[]
}

// Environment configuration
const AMEX_BENEFITS_URL = process.env.AMEX_BENEFITS_URL || 'https://www.americanexpress.com/en-us/colleagues/benefits'
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false'
const SCRAPER_TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT || '60000', 10)
const SCRAPER_MAX_RETRIES = parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10)
const MAX_PAGES_TO_CRAWL = parseInt(process.env.MAX_PAGES_TO_CRAWL || '20', 10)

// Rate limiting configuration
const RATE_LIMIT_MIN_MS = 2000 // Minimum 2 seconds
const RATE_LIMIT_MAX_MS = 5000 // Maximum 5 seconds

// User-Agent rotation for politeness
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]

// Singleton browser instance
let browserInstance: Browser | null = null
let browserContext: BrowserContext | null = null

// OpenAI client for content extraction
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Get or create a browser instance (singleton pattern)
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    console.log('Launching Chromium browser...')
    browserInstance = await chromium.launch({
      headless: PLAYWRIGHT_HEADLESS,
      args: ['--disable-blink-features=AutomationControlled'],
    })

    // Cleanup on process exit
    process.on('exit', () => {
      if (browserInstance) {
        browserInstance.close().catch(console.error)
      }
    })

    process.on('SIGINT', () => {
      if (browserInstance) {
        browserInstance.close().catch(console.error)
      }
      process.exit(0)
    })
  }
  return browserInstance
}

/**
 * Get or create a browser context
 */
async function getBrowserContext(): Promise<BrowserContext> {
  if (!browserContext) {
    const browser = await getBrowser()
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

    browserContext = await browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    })
  }
  return browserContext
}

/**
 * Close browser and cleanup resources
 */
export async function closeBrowser(): Promise<void> {
  if (browserContext) {
    await browserContext.close()
    browserContext = null
  }
  if (browserInstance) {
    await browserInstance.close()
    browserInstance = null
  }
  console.log('Browser closed')
}

/**
 * Extract clean content using OpenAI GPT-4o-mini (with aggressive HTML reduction)
 */
async function extractContentWithLLM(html: string, url: string): Promise<{ content: string; title: string }> {
  try {
    console.log(`  Using GPT-4o-mini to extract content from ${url}...`)

    // Strip scripts, styles, and non-content elements first
    const cleanedHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')

    // Aggressively truncate for GPT-4 token limits (rate limit is 10k tokens/min)
    const maxHtmlLength = 20000 // ~5k tokens to stay well under limits
    const truncatedHtml = cleanedHtml.length > maxHtmlLength
      ? cleanedHtml.substring(0, maxHtmlLength) + '\n...[truncated]'
      : cleanedHtml

    console.log(`  Sending ${truncatedHtml.length} chars to GPT-4o-mini (original: ${html.length})`)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a web scraping assistant. Extract the main content from HTML pages about employee benefits.
Remove navigation, ads, footers, sidebars, and other non-content elements.
Focus on extracting information about medical, dental, vision, retirement, insurance, and wellness benefits.

Return a JSON object with:
- title: The main page title
- content: Clean, formatted text content with benefit details (preserve structure with headings and bullet points where appropriate)`
        },
        {
          role: 'user',
          content: `Extract the main benefits content from this HTML:\n\n${truncatedHtml}`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 2000, // Limit response size
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    // Ensure content is always a string
    const content = typeof result.content === 'string' ? result.content : String(result.content || '')
    const title = typeof result.title === 'string' ? result.title : String(result.title || 'Benefits Page')

    console.log(`  ✓ GPT-4o-mini extracted content: ${title} (${content.length} chars)`)

    return {
      title,
      content,
    }
  } catch (error) {
    console.error(`  Error in LLM extraction:`, error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Scrape a single benefits page with retry logic
 */
async function scrapePage(url: string, retryCount = 0): Promise<ScrapedPage | null> {
  let page: Page | null = null

  try {
    console.log(`Scraping: ${url} (attempt ${retryCount + 1}/${SCRAPER_MAX_RETRIES})`)

    const context = await getBrowserContext()
    page = await context.newPage()

    // Set page timeout explicitly
    page.setDefaultTimeout(SCRAPER_TIMEOUT)

    // Navigate to the page with timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded', // Changed from 'networkidle' for faster loading
      timeout: SCRAPER_TIMEOUT,
    })

    // Wait a bit for JS to render
    await page.waitForTimeout(2000)

    // Handle common blocking dialogs (cookie consent, terms, etc.)
    try {
      // Look for "Agree", "Accept", "I Agree", "OK" buttons
      const dialogSelectors = [
        'button:has-text("Agree")',
        'button:has-text("I Agree")',
        'button:has-text("Accept")',
        'button:has-text("Continue")',
        'button:has-text("OK")',
        '[data-testid="agree-button"]',
        '[aria-label*="agree" i]',
        '[aria-label*="accept" i]',
      ]

      for (const selector of dialogSelectors) {
        const button = page.locator(selector).first()
        if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`  Found dialog button: ${selector}, clicking...`)
          await button.click()
          await page.waitForTimeout(1000) // Wait for dialog to close
          break
        }
      }
    } catch (dialogError) {
      // Ignore dialog handling errors - page might not have dialogs
      console.log(`  No dialogs found or error clicking: ${dialogError instanceof Error ? dialogError.message : 'unknown'}`)
    }

    // Wait for main content to render after dialog handling
    await page.waitForTimeout(1000)

    // Extract page title
    const title = await page.title()

    // Extract all headings
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', (elements) =>
      elements
        .map(el => el.textContent?.trim())
        .filter(text => text && text.length > 5)
        .slice(0, 20)
    ) as string[]

    // Get the full HTML for LLM processing
    const html = await page.content()

    // Use GPT-4o-mini to extract clean content
    const extracted = await extractContentWithLLM(html, url)

    // Validate content
    if (!extracted.content || extracted.content.length < 100) {
      console.log(`  Insufficient content found for ${url} (${extracted.content?.length || 0} chars)`)
      await page.close()
      return null
    }

    console.log(`✓ Scraped ${url}: ${extracted.title} (${extracted.content.length} chars, ${headings.length} headings)`)

    await page.close()

    return {
      url,
      title: extracted.title || title || 'Benefits Page',
      content: extracted.content,
      headings,
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error instanceof Error ? error.message : error)

    // Capture screenshot on error for debugging
    if (page) {
      try {
        const screenshotPath = `/tmp/scraper-error-${Date.now()}.png`
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`  Screenshot saved to ${screenshotPath}`)
      } catch (screenshotError) {
        // Ignore screenshot errors
      }
    }

    await page?.close()

    // Retry logic with exponential backoff
    if (retryCount < SCRAPER_MAX_RETRIES - 1) {
      const backoffMs = Math.pow(2, retryCount) * 1000
      console.log(`  Retrying in ${backoffMs}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoffMs))
      return scrapePage(url, retryCount + 1)
    }

    return null
  }
}

/**
 * Get random delay between requests (for rate limiting)
 */
function getRandomDelay(): number {
  return Math.floor(Math.random() * (RATE_LIMIT_MAX_MS - RATE_LIMIT_MIN_MS) + RATE_LIMIT_MIN_MS)
}

/**
 * Normalize URL to avoid duplicates
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remove trailing slash, fragments, and common tracking params
    urlObj.hash = ''
    urlObj.search = ''
    let normalized = urlObj.toString()
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }
    return normalized
  } catch (e) {
    return url
  }
}

/**
 * Check if URL should be crawled (benefits-related pages only)
 */
function shouldCrawlUrl(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url)
    const baseUrlObj = new URL(baseUrl)

    // Must be same domain
    if (urlObj.hostname !== baseUrlObj.hostname) {
      return false
    }

    // Must contain benefits or colleagues in path
    const path = urlObj.pathname.toLowerCase()
    if (!path.includes('benefits') && !path.includes('colleagues')) {
      return false
    }

    // Skip non-HTML resources
    const skipExtensions = ['.pdf', '.jpg', '.png', '.gif', '.css', '.js', '.xml', '.zip']
    if (skipExtensions.some(ext => path.endsWith(ext))) {
      return false
    }

    return true
  } catch (e) {
    return false
  }
}

/**
 * Discover links on a page
 */
async function discoverLinks(page: Page, _currentUrl: string, baseUrl: string): Promise<Array<{ url: string; text: string }>> {
  try {
    const links = await page.$$eval('a[href]', (elements, baseUrl) => {
      return elements
        .map(el => {
          const href = el.getAttribute('href')
          const text = el.textContent?.trim() || ''
          if (!href) return null

          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, baseUrl)
            return { url: absoluteUrl.toString(), text }
          } catch (e) {
            return null
          }
        })
        .filter(link => link !== null) as Array<{ url: string; text: string }>
    }, baseUrl)

    // Filter to only benefits-related links
    return links.filter(link => shouldCrawlUrl(link.url, baseUrl))
  } catch (error) {
    console.error('Error discovering links:', error)
    return []
  }
}

/**
 * Crawl benefits pages using BFS (Breadth-First Search)
 */
export async function crawlBenefitsPages(): Promise<CrawlResult> {
  console.log('Starting intelligent benefits crawl with BFS...')
  console.log(`Max pages to crawl: ${MAX_PAGES_TO_CRAWL}`)

  const pages: ScrapedPage[] = []
  const navigationSteps: NavigationStep[] = []
  const visited = new Set<string>()
  const queue: Array<{ url: string; depth: number; parentUrl: string | null; linkText: string | null }> = []

  try {
    // Start from the base URL
    const startUrl = normalizeUrl(AMEX_BENEFITS_URL)
    queue.push({ url: startUrl, depth: 0, parentUrl: null, linkText: null })

    while (queue.length > 0 && pages.length < MAX_PAGES_TO_CRAWL) {
      const current = queue.shift()!
      const normalizedUrl = normalizeUrl(current.url)

      // Skip if already visited
      if (visited.has(normalizedUrl)) {
        continue
      }

      visited.add(normalizedUrl)

      console.log(`\n[${pages.length + 1}/${MAX_PAGES_TO_CRAWL}] Visiting: ${current.url} (depth: ${current.depth})`)

      // Record navigation step
      const navStep: NavigationStep = {
        url: current.url,
        depth: current.depth,
        parentUrl: current.parentUrl,
        linkText: current.linkText,
        visitedAt: new Date(),
        scraped: false,
      }

      // Try to scrape the page
      const scrapedPage = await scrapePage(current.url)

      if (scrapedPage) {
        pages.push(scrapedPage)
        navStep.scraped = true
        console.log(`  ✓ Successfully scraped (${pages.length}/${MAX_PAGES_TO_CRAWL})`)
      } else {
        console.log(`  ✗ Failed to scrape or insufficient content`)
      }

      navigationSteps.push(navStep)

      // Discover new links if we haven't reached the page limit
      if (pages.length < MAX_PAGES_TO_CRAWL) {
        try {
          const context = await getBrowserContext()
          const page = await context.newPage()

          // Set page timeout
          page.setDefaultTimeout(SCRAPER_TIMEOUT)

          await page.goto(current.url, {
            waitUntil: 'domcontentloaded',
            timeout: SCRAPER_TIMEOUT,
          })

          await page.waitForTimeout(1000)

          // Handle dialogs before discovering links
          try {
            const dialogSelectors = [
              'button:has-text("Agree")',
              'button:has-text("I Agree")',
              'button:has-text("Accept")',
              'button:has-text("Continue")',
              'button:has-text("OK")',
            ]

            for (const selector of dialogSelectors) {
              const button = page.locator(selector).first()
              if (await button.isVisible({ timeout: 1000 }).catch(() => false)) {
                await button.click()
                await page.waitForTimeout(500)
                break
              }
            }
          } catch {
            // Ignore dialog errors
          }

          const discoveredLinks = await discoverLinks(page, current.url, AMEX_BENEFITS_URL)
          await page.close()

          console.log(`  Found ${discoveredLinks.length} benefit-related links`)

          // Add discovered links to queue
          for (const link of discoveredLinks) {
            const normalizedLinkUrl = normalizeUrl(link.url)
            if (!visited.has(normalizedLinkUrl) && !queue.some(q => normalizeUrl(q.url) === normalizedLinkUrl)) {
              queue.push({
                url: link.url,
                depth: current.depth + 1,
                parentUrl: current.url,
                linkText: link.text.substring(0, 200), // Limit text length
              })
            }
          }

          console.log(`  Queue size: ${queue.length}, Visited: ${visited.size}`)
        } catch (error) {
          console.error('  Error discovering links:', error instanceof Error ? error.message : error)
        }
      }

      // Rate limiting between pages
      if (queue.length > 0) {
        const delay = getRandomDelay()
        console.log(`  Waiting ${delay}ms before next page...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    console.log(`\n✓ Crawl completed: ${pages.length} pages scraped, ${navigationSteps.length} steps taken`)

    // Cleanup browser after crawl
    await closeBrowser()

    return {
      pages,
      navigationSteps,
    }
  } catch (error) {
    console.error('Error in crawlBenefitsPages:', error)
    await closeBrowser()
    throw error
  }
}
