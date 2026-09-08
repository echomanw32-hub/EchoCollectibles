const READERS_HEADERS_MARKETPLACE = 'EBAY_US'

async function getAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET environment variables')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`eBay auth failed (${res.status}): ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  return data.access_token
}

async function searchItems(query, token, byGtin) {
  const param = byGtin ? `gtin=${encodeURIComponent(query)}` : `q=${encodeURIComponent(query)}`
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${param}&limit=10`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': READERS_HEADERS_MARKETPLACE
    }
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.itemSummaries ?? []
}

async function lookupBarcode(barcode, token) {
  try {
    // Barcodes are GTINs — search by GTIN first for the most precise match.
    let items = await searchItems(barcode, token, true)
    // Not every listing has GTIN attached, so fall back to a keyword search.
    if (items.length === 0) {
      items = await searchItems(barcode, token, false)
    }

    if (items.length === 0) {
      return { barcode, found: false, title: null, imageUrl: null, marketValue: 0 }
    }

    const title = items[0].title
    const imageUrl = items[0].image?.imageUrl ?? items[0].thumbnailImages?.[0]?.imageUrl ?? null

    const prices = items
      .map((it) => parseFloat(it.price?.value))
      .filter((v) => !Number.isNaN(v))

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

  try {
    const token = await getAccessToken()
    // Cap batch size to stay well within Vercel's execution time limits
    const batch = barcodes.slice(0, 25)
    const results = await Promise.all(batch.map((b) => lookupBarcode(b, token)))
    return res.status(200).json({ results })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
