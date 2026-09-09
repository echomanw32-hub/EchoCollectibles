# EchoCollectibles

Scan collectible barcodes, auto-fetch eBay sold-listing prices and images, and track portfolio value across custom collections. Built to match BrainEcho's charcoal/mint look and stack: React + Vite + Tailwind, Supabase, Vercel serverless functions.

## Setup

1. `npm install`
2. Create a Supabase project, then run `supabase/schema.sql` in the SQL editor.
3. In Supabase Auth settings, enable **Anonymous sign-ins** (the app signs users in anonymously so there's no login screen — swap in email/password or magic-link auth later if you want accounts).
4. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key (and eBay credentials — see below).
5. `npm run dev` to run locally.

### Testing the camera on your phone

Browsers block camera access (`getUserMedia`) on any origin that isn't HTTPS or `localhost`. If you open the dev server from your phone via your computer's LAN IP (e.g. `http://192.168.x.x:5173`), the camera will silently fail — not a bug, just how browsers treat insecure origins. `npm run dev` now serves over HTTPS with a self-signed dev certificate (via `@vitejs/plugin-basic-ssl`) specifically so this works: run `npm run dev`, then open the printed `https://<your-LAN-IP>:5173` URL on your phone. Your browser will show a "connection not private" warning on first visit — that's expected for a self-signed cert, tap through it. (Deployed on Vercel, this is a non-issue — it's HTTPS by default.)

## Deploying to Vercel

- Push to GitHub (GitHub Desktop works fine) and import the repo in Vercel.
- Add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` in the Vercel project's env var settings.
- The `/api/price/bulk` folder is auto-detected as a serverless function — no extra config needed.

## eBay price lookup

`api/price/bulk.js` uses eBay's official **Browse API** (server-to-server OAuth via client credentials — no user eBay login involved). It searches by GTIN (your barcode) first, falling back to a keyword search if a listing has no GTIN attached.

You'll need a free eBay Developer account (https://developer.ebay.com) — create a production keyset, enable the Buy Browse API, and set `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` as **server-side** env vars (not `VITE_`-prefixed — they must never ship to the browser).

**Known limitation, not a bug**: eBay's public API only exposes *active* listing prices. Sold/completed-listing price history lives in eBay's Marketplace Insights API, which requires a special restricted-access grant eBay doesn't hand out to normal developer accounts. So "market value" here means the average current asking price across matching active listings, not a historical sale average — a reasonable proxy, but worth knowing if a number looks off.

The previous version scraped eBay's search-results RSS feed (`_rss=1`). That output has effectively been dead for years — eBay's site now returns a normal HTML page (or a bot-check page) instead of XML for that param, and the "completed/sold" filter requires a logged-in session a server-side fetch doesn't have. That's why nothing was ever found; it wasn't a parsing issue, the data path itself no longer works.

**Also worth knowing**: eBay only matches a barcode to a listing if a seller explicitly tagged that GTIN/UPC/EAN on their listing — it's a database lookup against seller-entered data, not barcode recognition on eBay's end. Many collectibles (individual comics, single trading cards, vintage toys, handmade items) never had a factory barcode at all, and even sellers of items that do have one often don't fill in that field. So "no listing found" for a barcode that scanned correctly can be expected behavior for a chunk of collectibles, not a bug — the keyword fallback search helps some, but doesn't close that gap entirely.

## Adding to a home screen

- **iOS**: the app shows a custom "tap Share → Add to Home Screen" tooltip on first visit in Safari (iOS has no native install prompt).
- **Android**: Chrome fires `beforeinstallprompt`, which the app catches to show a native "Install" button.

## Troubleshooting

- **"Can't create a collection" / nothing happens when I tap Create**: this was a real bug, not a config issue. `React.StrictMode` (in `main.jsx`) double-invokes effects in dev, so the app's init effect was calling `signInAnonymously()` twice on load, creating two separate anonymous users in a race. React's `userId` state could end up out of sync with whichever session the Supabase client actually had active, so the insert's `user_id` didn't match `auth.uid()` in the request's JWT — the RLS policy silently rejected it. Fixed two ways: the init effect now only runs once (guarded with a ref), and every write now pulls the current user via `supabase.auth.getUser()` at the moment of the request instead of trusting React state. Any remaining save failures now show a red banner with the actual error instead of only logging to console.
- **Camera opens but nothing scans / shutter button seems permanently disabled**: this was a real logic bug, not a tuning issue. The button was `disabled={!detectedCode}` — it could only unlock *after* the live decoder already succeeded on its own, so if live detection never fired, there was no way to trigger a capture at all. It's rebuilt now: the camera preview is a plain `<video>` feed (no live decode loop running), the shutter is always enabled once the camera starts, and pressing it grabs the current frame and runs a single still-image decode (`Quagga.decodeSingle`) — which is both more reliable than real-time decoding and gives you clear success/"not found, try again" feedback either way. There's also a manual number-entry field under the camera as a guaranteed fallback, so a bad decode never fully blocks you from adding an item.
- Swapped the decoding engine from `html5-qrcode` (ZXing-js, weak at 1D barcodes) to **Quagga2** (`@ericblade/quagga2`), which is purpose-built for UPC/EAN-style barcodes and works on iOS Safari (unlike the native `BarcodeDetector` API, which Safari doesn't support at all).
- **Typing a barcode manually and tapping Add seemed to do nothing**: this was a real UI bug — the "captured items" confirmation list only rendered in Bulk mode. In Single mode, adding a code updated the queue internally (the button at the bottom did change to "Process & Fetch All (1)"), but there was no visible confirmation near the input, so it looked like nothing happened. Fixed: the captured list now always shows, in both modes.
- **Camera works, shutter fires, but decode always says "not found"**: the pipeline was working — the actual image handed to the decoder just wasn't good enough. A 1D barcode decoder needs the bars to be reasonably large and sharp in the analyzed image; a barcode occupying a small part of a full 1280×720 frame becomes too blurry to resolve reliably no matter what format/locator settings are set. Fixed by adding an on-screen alignment box: capture now crops to just that box, upscales it before decoding, and falls back to trying the full frame if the cropped attempt fails. Fill the dashed box with the barcode (get close, keep it roughly horizontal and well-lit) for the best odds.

## Icons

Drop your own `icon-192.png` and `icon-512.png` into `public/icons/` before deploying — the manifest (generated by `vite-plugin-pwa`, configured in `vite.config.js`) references them for both iOS and Android home-screen icons.
