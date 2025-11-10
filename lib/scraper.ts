import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedPage {
  url: string
  title: string
  content: string
  headings: string[]
}

const AMEX_BENEFITS_URL = process.env.AMEX_BENEFITS_URL || 'https://www.aexp.com/benefits'
const RATE_LIMIT_MS = 1000 // 1 second between requests

/**
 * Get all benefit page URLs from the AmEx benefits site
 */
async function getAllBenefitUrls(): Promise<string[]> {
  try {
    console.log('Fetching benefits index page...')
    const response = await axios.get(AMEX_BENEFITS_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AmExBenefitsBot/1.0)',
      },
    })

    const $ = cheerio.load(response.data)
    const urls = new Set<string>()

    // Find all links that point to benefit pages
    $('a[href*="/benefits/"]').each((_, element) => {
      const href = $(element).attr('href')
      if (href && href.startsWith('/benefits/')) {
        // Convert relative URL to absolute
        const absoluteUrl = new URL(href, AMEX_BENEFITS_URL).toString()
        urls.add(absoluteUrl)
      }
    })

    console.log(`Found ${urls.size} benefit pages`)
    return Array.from(urls)
  } catch (error) {
    console.error('Error fetching benefits index:', error)
    return []
  }
}

/**
 * Scrape a single benefits page
 */
async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    console.log(`Scraping: ${url}`)
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AmExBenefitsBot/1.0)',
      },
    })

    const $ = cheerio.load(response.data)

    // Extract title
    let title = $('h1').first().text().trim()
    if (!title) {
      title = $('title').text().trim()
    }

    // Extract all headings
    const headings: string[] = []
    $('h1, h2, h3, h4, h5, h6').each((_, element) => {
      const text = $(element).text().trim()
      if (text) headings.push(text)
    })

    // Extract main content (paragraphs, lists)
    const contentElements: string[] = []
    $('p, li, td, dd').each((_, element) => {
      const text = $(element).text().trim()
      if (text && text.length > 20) {
        // Only include substantial text
        contentElements.push(text)
      }
    })

    const content = contentElements.join('\n\n')

    if (!content) {
      console.log(`No content found for ${url}`)
      return null
    }

    return {
      url,
      title: title || 'Untitled',
      content,
      headings,
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error)
    return null
  }
}

/**
 * Crawl all benefit pages with rate limiting
 */
export async function crawlBenefitsPages(): Promise<ScrapedPage[]> {
  console.log('Starting benefits crawl...')

  // For MVP, we'll scrape some demo content instead of the actual site
  // This prevents hitting rate limits during development
  const demoPages = getDemoPages()

  console.log(`Using ${demoPages.length} demo pages for testing`)
  return demoPages
}

/**
 * Get demo pages for testing (to avoid hitting real site repeatedly)
 */
function getDemoPages(): ScrapedPage[] {
  return [
    {
      url: 'https://www.aexp.com/benefits/medical',
      title: 'Medical Plans',
      content: `Our medical plans include comprehensive coverage for preventive care, office visits, and specialist care.

Plan Options:
- PPO Plan: Lower out-of-pocket with flexibility to see any provider
- HMO Plan: Lower premiums with focus on in-network care
- HDHP: High deductible plan paired with HSA for tax advantages

Deductibles range from $500 to $2,500 depending on plan selection.
Coverage includes preventive care at 100%, office visits at $30 copay, and specialist visits at $50 copay.

The plan covers hospitalization, emergency room visits, and prescription medications.
Preventive services like annual physicals and screenings are covered at no cost.`,
      headings: ['Medical Plans', 'Plan Options', 'Deductibles', 'Coverage Details'],
    },
    {
      url: 'https://www.aexp.com/benefits/retirement',
      title: 'Retirement Plans',
      content: `American Express offers comprehensive retirement benefits to help you save for your future.

401(k) Plan:
- Company matching: 50% match on first 6% of salary, up to 3% of gross salary
- Vesting: Immediate vesting of employee contributions, 3-year cliff vesting for employer match
- Investment options: 40+ funds including target-date funds
- Contribution limits: Up to $23,500 per year (2024)

Roth 401(k) available with same matching and vesting schedules.

HSA/FSA Options:
- HSA contribution limit: $4,150 for individuals, $8,300 for families (2024)
- FSA contribution limit: $3,300 per year
- HSA funds roll over year to year, FSA has use-it-or-lose-it

Pension Plan:
- Defined benefit pension available for eligible employees
- Accrual rate: 1.5% per year of service
- Normal retirement age: 65`,
      headings: ['Retirement Plans', '401(k) Plan', 'HSA/FSA Options', 'Pension Plan'],
    },
    {
      url: 'https://www.aexp.com/benefits/enrollment',
      title: 'Open Enrollment',
      content: `Open Enrollment Period:
- 2025 Open Enrollment: November 1-30, 2024
- 2024 Open Enrollment: November 1-30, 2023

What You Can Change:
- Medical plan selection
- Dental plan selection
- Vision plan selection
- FSA/HSA contributions
- Life insurance elections

Important Dates:
- Enrollment deadline: November 30, 2024 at 11:59 PM EST
- Changes effective: January 1, 2025
- Qualifying life events: Can make changes within 30 days of event

No enrollment required if keeping current elections.
Late enrollees may face waiting periods or higher premiums.`,
      headings: ['Open Enrollment Period', 'What You Can Change', 'Important Dates'],
    },
    {
      url: 'https://www.aexp.com/benefits/dental',
      title: 'Dental Plans',
      content: `Dental coverage is designed to help maintain your oral health while managing costs.

Plan Types:
- PPO Dental: Most flexible, see any dentist, higher out-of-pocket
- HMO Dental: Lower premiums, must use network dentists
- Fee-for-Service: Traditional plan with reasonable and customary fees

Coverage Details:
- Preventive: 100% coverage (cleanings, exams, X-rays)
- Basic: 80% coverage (fillings, extractions, minor procedures)
- Major: 50% coverage (root canals, crowns, bridges)
- Orthodontia: 50% coverage, lifetime maximum $2,500 (plan dependent)

Annual Maximums:
- Most plans: $1,500-$2,000 annual maximum
- Orthodontia: Separate lifetime maximum

No waiting periods for preventive care.
Waiting periods may apply for basic and major services.`,
      headings: ['Dental Plans', 'Plan Types', 'Coverage Details', 'Annual Maximums'],
    },
    {
      url: 'https://www.aexp.com/benefits/vision',
      title: 'Vision Plans',
      content: `Vision benefits help you maintain healthy eyesight and manage the cost of eye care.

Covered Services:
- Eye exams: Once every 24 months at no cost
- Eyeglasses: $150 allowance every 24 months
- Contact lenses: $150 allowance every 24 months (instead of glasses)
- Laser eye surgery (LASIK): 15-25% discount with network providers

Frames and Lenses:
- Frames covered up to $150 when combined with exam coverage
- Standard plastic lenses included with exam coverage
- Progressive lenses: Additional $50 copay
- Photochromic lenses: Additional $75 copay

Network:
- In-network providers: No out-of-pocket costs for covered services
- Out-of-network: Reimbursement up to plan allowances
- National network includes LensCrafters, Pearle Vision, and independent optometrists`,
      headings: ['Vision Plans', 'Covered Services', 'Frames and Lenses', 'Network'],
    },
  ]
}

/**
 * Scrape real pages from AmEx (use cautiously to avoid rate limits)
 *
 * NOTE: This function is available for production use but currently not called
 * by default. To use real scraping instead of demo data:
 * 1. Update crawlBenefitsPages() to call crawlBenefitsPagesReal()
 * 2. Ensure you have proper rate limiting and error handling
 * 3. Respect AmEx's robots.txt and terms of service
 */
export async function crawlBenefitsPagesReal(): Promise<ScrapedPage[]> {
  const urls = await getAllBenefitUrls()
  const pages: ScrapedPage[] = []

  for (const url of urls) {
    const page = await scrapePage(url)
    if (page) {
      pages.push(page)
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))
  }

  console.log(`Successfully crawled ${pages.length} pages`)
  return pages
}
