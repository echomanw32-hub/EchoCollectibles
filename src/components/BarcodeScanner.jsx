import { useEffect, useRef, useState } from 'react'
import Quagga from '@ericblade/quagga2'

const READERS = [
  'ean_reader',
  'ean_8_reader',
  'upc_reader',
  'upc_e_reader',
  'code_128_reader',
  'code_39_reader',
  'codabar_reader'
]

// Quagga fires onDetected many times per second while a barcode is in
// frame. If nothing new comes in for this long, treat it as "lost" so the
// UI doesn't keep showing a stale "Detected" pill after you move the camera.
const DETECTION_TIMEOUT_MS = 1200

export default function BarcodeScanner({ collectionName, onProcess, processing }) {
  const [mode, setMode] = useState('bulk') // 'single' | 'bulk'
  const [queue, setQueue] = useState([])
  const [detectedCode, setDetectedCode] = useState(null)
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)

  const viewportRef = useRef(null)
  const detectedCodeRef = useRef(null)
  const clearTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: viewportRef.current,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2,
        decoder: { readers: READERS },
        locate: true
      },
      (err) => {
        if (cancelled) return
        if (err) {
          setError('Camera unavailable: ' + err.message)
          return
        }
        Quagga.start()
        setCameraReady(true)
      }
    )

    function onDetected(result) {
      const code = result?.codeResult?.code
      if (!code) return
      detectedCodeRef.current = code
      setDetectedCode(code)

      clearTimeout(clearTimerRef.current)
      clearTimerRef.current = setTimeout(() => {
        detectedCodeRef.current = null
        setDetectedCode(null)
      }, DETECTION_TIMEOUT_MS)
    }

    Quagga.onDetected(onDetected)

    return () => {
      cancelled = true
      clearTimeout(clearTimerRef.current)
      Quagga.offDetected(onDetected)
      Quagga.stop()
    }
  }, [])

  function capture() {
    const code = detectedCodeRef.current
    if (!code) return

    if (mode === 'single') {
      setQueue([{ code, id: Date.now() }])
    } else {
      setQueue((prev) => [...prev, { code, id: Date.now() }])
    }

    setFlash(true)
    setTimeout(() => setFlash(false), 300)
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

        <div className="flex items-center bg-charcoal-800 border border-charcoal-600 rounded-full p-1">
          {['single', 'bulk'].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
                mode === m ? 'bg-mint-500 text-charcoal-900' : 'text-neutral-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-xl2 overflow-hidden border border-charcoal-600 [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_canvas]:absolute [&_canvas]:inset-0 [&_canvas]:w-full [&_canvas]:h-full">
        <div ref={viewportRef} className="relative w-full aspect-[4/3] bg-black" />

        <div
          className={`pointer-events-none absolute inset-0 border-4 transition-opacity ${
            flash ? 'opacity-100 border-mint-400' : 'opacity-0 border-transparent'
          }`}
        />

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <span
            className={`flex-1 truncate text-xs rounded-full px-3 py-2 ${
              detectedCode
                ? 'bg-mint-500/90 text-charcoal-900 font-medium'
                : 'bg-charcoal-900/80 text-neutral-400'
            }`}
          >
            {detectedCode ? `Detected: ${detectedCode}` : 'Point camera at a barcode…'}
          </span>

          <button
            onClick={capture}
            disabled={!detectedCode}
            className="shrink-0 h-14 w-14 rounded-full bg-white disabled:bg-neutral-500/40 border-4 border-charcoal-900/60 shadow-lg active:scale-90 transition"
            aria-label="Capture barcode"
          />
        </div>

        {error && (
          <p className="absolute top-2 left-2 right-2 text-xs text-red-400 bg-charcoal-900/80 rounded px-2 py-1">
            {error}
          </p>
        )}
        {!cameraReady && !error && (
          <p className="absolute top-2 left-2 right-2 text-xs text-neutral-400 bg-charcoal-900/80 rounded px-2 py-1">
            Starting camera…
          </p>
        )}
      </div>

      {mode === 'bulk' && queue.length > 0 && (
        <div className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-3">
          <p className="text-xs text-neutral-400 mb-2">{queue.length} captured</p>
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
