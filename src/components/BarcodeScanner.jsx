import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

const SCANNER_ID = 'ec-scanner-region'

export default function BarcodeScanner({ collectionName, onProcess, processing }) {
  const [bulkMode, setBulkMode] = useState(true)
  const [queue, setQueue] = useState([])
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState(null)
  const scannerRef = useRef(null)
  const lastCodeRef = useRef({ code: null, at: 0 })

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 260, height: 160 } },
        (decodedText) => handleDecoded(decodedText),
        () => {}
      )
      .catch((err) => setError('Camera unavailable: ' + err))

    return () => {
      scanner.stop().catch(() => {}).finally(() => scanner.clear())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDecoded(code) {
    const now = Date.now()
    // debounce the same barcode re-firing while it's still in frame
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 2500) return
    lastCodeRef.current = { code, at: now }

    setQueue((prev) => {
      if (!bulkMode) return [{ code, id: now }]
      if (prev.some((p) => p.code === code)) return prev
      return [...prev, { code, id: now }]
    })

    setFlash(true)
    setTimeout(() => setFlash(false), 350)
    if (navigator.vibrate) navigator.vibrate(40)
  }

  function removeFromQueue(id) {
    setQueue((prev) => prev.filter((p) => p.id !== id))
  }

  function process() {
    if (queue.length === 0) return
    onProcess(queue.map((q) => q.code))
    setQueue([])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-100">Scan</h2>
          <p className="text-xs text-neutral-500">Adding to: {collectionName}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-300">
          Bulk
          <button
            onClick={() => setBulkMode((v) => !v)}
            className={`w-11 h-6 rounded-full relative transition ${bulkMode ? 'bg-mint-500' : 'bg-charcoal-600'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                bulkMode ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>

      <div className="relative rounded-xl2 overflow-hidden border border-charcoal-600">
        <div id={SCANNER_ID} className="w-full aspect-[3/4] bg-black" />
        <div
          className={`pointer-events-none absolute inset-0 border-4 transition-opacity ${
            flash ? 'opacity-100 border-mint-400' : 'opacity-0 border-transparent'
          }`}
        />
        {error && (
          <p className="absolute bottom-2 left-2 right-2 text-xs text-red-400 bg-charcoal-900/80 rounded px-2 py-1">
            {error}
          </p>
        )}
      </div>

      {queue.length > 0 && (
        <div className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-3">
          <p className="text-xs text-neutral-400 mb-2">{queue.length} scanned</p>
          <div className="flex flex-wrap gap-2">
            {queue.map((q) => (
              <span
                key={q.id}
                className="flex items-center gap-1.5 text-xs bg-charcoal-900 rounded-full pl-3 pr-1.5 py-1 border border-charcoal-600"
              >
                {q.code}
                <button
                  onClick={() => removeFromQueue(q.id)}
                  className="h-4 w-4 rounded-full bg-charcoal-600 text-neutral-300 flex items-center justify-center"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={process}
        disabled={queue.length === 0 || processing}
        className="w-full bg-mint-500 disabled:bg-charcoal-600 disabled:text-neutral-500 text-charcoal-900 font-semibold rounded-lg py-3 active:scale-95 transition"
      >
        {processing ? 'Fetching prices…' : `Process & Fetch All (${queue.length})`}
      </button>
    </div>
  )
}
