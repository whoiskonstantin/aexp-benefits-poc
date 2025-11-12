import { chromium, Browser, Page, BrowserContext } from 'playwright'
import { OpenAI } from 'openai'

export interface ScrapedPage {
  url: string
  title: string
  content: string
  headings: string[]
}

// Environment configuration
const AMEX_BENEFITS_URL = process.env.AMEX_BENEFITS_URL || 'https://www.americanexpress.com/en-us/colleagues/benefits'
const PLAYWRIGHT_HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false'
const SCRAPER_TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT || '60000', 10)
const SCRAPER_MAX_RETRIES = parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10)

// Rate limiting configuration
const RATE_LIMIT_MIN_MS = 2000 // Minimum 2 seconds
const RATE_LIMIT_MAX_MS = 5000 // Maximum 5 seconds

// Key benefit pages to scrape
const BENEFIT_PAGE_PATHS = [
  '/en-us/colleagues/benefits/medical',
  '/en-us/colleagues/benefits/dental',
  '/en-us/colleagues/benefits/vision',
  '/en-us/colleagues/benefits/retirement',
  '/en-us/colleagues/benefits/life-insurance',
  '/en-us/colleagues/benefits/disability',
  '/en-us/colleagues/benefits/flexible-spending',
  '/en-us/colleagues/benefits/wellness',
]

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
 * Extract clean content using OpenAI GPT-4 (with aggressive HTML reduction)
 */
async function extractContentWithLLM(html: string, url: string): Promise<{ content: string; title: string }> {
  try {
    console.log(`  Using GPT-4 to extract content from ${url}...`)

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

    console.log(`  Sending ${truncatedHtml.length} chars to GPT-4 (original: ${html.length})`)

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

    console.log(`  ✓ GPT-4 extracted content: ${result.title || 'Unknown'} (${result.content?.length || 0} chars)`)

    return {
      title: result.title || 'Benefits Page',
      content: result.content || '',
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

    // Navigate to the page with timeout
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: SCRAPER_TIMEOUT,
    })

    // Wait for main content to render
    await page.waitForTimeout(2000) // Give JS time to render

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

    // Use GPT-4 to extract clean content
    const extracted = await extractContentWithLLM(html, url)

    // Validate content
    if (!extracted.content || extracted.content.length < 100) {
      console.log(`  Insufficient content found for ${url} (${extracted.content?.length || 0} chars)`)
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
 * Get all benefit page URLs from the AmEx benefits site
 */
async function getAllBenefitUrls(): Promise<string[]> {
  try {
    console.log('Discovering benefit pages...')

    const urls = new Set<string>()
    const baseUrl = 'https://www.americanexpress.com'

    // Add predefined benefit pages
    for (const path of BENEFIT_PAGE_PATHS) {
      urls.add(new URL(path, baseUrl).toString())
    }

    // Try to discover additional pages from the main benefits page
    try {
      const context = await getBrowserContext()
      const page = await context.newPage()

      await page.goto(AMEX_BENEFITS_URL, {
        waitUntil: 'networkidle',
        timeout: SCRAPER_TIMEOUT,
      })

      // Extract benefit links
      const links = await page.$$eval('a[href*="benefits"]', (elements) =>
        elements
          .map(el => el.getAttribute('href'))
          .filter(href => href && (href.includes('/benefits/') || href.includes('/colleagues/benefits/')))
      ) as string[]

      for (const href of links) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString()
          if (absoluteUrl.includes('benefits')) {
            urls.add(absoluteUrl)
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }

      await page.close()
    } catch (error) {
      console.warn('Could not fetch additional benefit pages from index:', error instanceof Error ? error.message : error)
    }

    const urlArray = Array.from(urls)
    console.log(`Discovered ${urlArray.length} benefit pages to crawl`)
    return urlArray
  } catch (error) {
    console.error('Error discovering benefits pages:', error)
    // Return predefined URLs as fallback
    const baseUrl = 'https://www.americanexpress.com'
    return BENEFIT_PAGE_PATHS.map(path => new URL(path, baseUrl).toString())
  }
}

/**
 * Crawl all benefit pages with rate limiting
 */
export async function crawlBenefitsPages(): Promise<ScrapedPage[]> {
  console.log('Starting benefits crawl with Playwright + GPT-4...')

  try {
    const urls = await getAllBenefitUrls()
    const pages: ScrapedPage[] = []

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      const page = await scrapePage(url)

      if (page) {
        pages.push(page)
      }

      // Rate limiting (except for last page)
      if (i < urls.length - 1) {
        const delay = getRandomDelay()
        console.log(`  Waiting ${delay}ms before next request...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    console.log(`Successfully crawled ${pages.length} pages`)

    // Cleanup browser after crawl
    await closeBrowser()

    return pages
  } catch (error) {
    console.error('Error in crawlBenefitsPages:', error)
    await closeBrowser()
    throw error
  }
}
