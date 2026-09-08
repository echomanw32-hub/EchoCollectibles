import { parseStringPromise } from 'xml2js'

const PRICE_RE = /\$([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/
const IMG_RE = /<img[^>]+src="([^"]+)"/i

async function lookupBarcode(barcode) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
    barcode
  )}&LH_Sold=1&LH_Complete=1&_rss=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EchoCollectibles/1.0)' }
    })
    if (!res.ok) throw new Error(`eBay responded ${res.status}`)
    const xml = await res.text()
    const parsed = await parseStringPromise(xml, { explicitArray: true, trim: true })

    const items = parsed?.rss?.channel?.[0]?.item ?? []
    if (items.length === 0) {
      return { barcode, found: false, title: null, imageUrl: null, marketValue: 0 }
    }

    const title = items[0].title?.[0] ?? barcode

    let imageUrl = null
    const prices = []

    for (const item of items.slice(0, 10)) {
      const description = item.description?.[0] ?? ''
      if (!imageUrl) {
        const imgMatch = description.match(IMG_RE)
        if (imgMatch) imageUrl = imgMatch[1]
      }
      const priceSource = `${item.title?.[0] ?? ''} ${description}`
      const priceMatch = priceSource.match(PRICE_RE)
      if (priceMatch) prices.push(parseFloat(priceMatch[1].replace(/,/g, '')))
    }

    const marketValue =
      prices.length > 0 ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100 : 0

    return { barcode, found: true, title, imageUrl, marketValue, sampleSize: prices.length }
  } catch (err) {
    return { barcode, found: false, title: null, imageUrl: null, marketValue: 0, error: err.message }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { barcodes } = req.body ?? {}
  if (!Array.isArray(barcodes) || barcodes.length === 0) {
    return res.status(400).json({ error: 'barcodes must be a non-empty array' })
  }

  // Cap batch size to stay well within Vercel's execution time limits
  const batch = barcodes.slice(0, 25)
  const results = await Promise.all(batch.map(lookupBarcode))

  return res.status(200).json({ results })
}
