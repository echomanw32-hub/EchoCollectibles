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

// The alignment guide box, as fractions of the video container. Kept in one
// place so the visual overlay and the crop math stay in sync.
const GUIDE = { xFrac: 0.06, yFrac: 0.36, wFrac: 0.88, hFrac: 0.26 }

// 1D barcodes need enough pixels per bar to decode reliably. A barcode that
// only occupies a small part of a full-frame photo gets too blurry once
// Quagga processes it. Cropping to just the guide box and upscaling that
// crop gives the decoder far more effective resolution on the actual bars.
const UPSCALED_WIDTH = 1400

function decodeOnce(src, locatorOptions) {
  return new Promise((resolve) => {
    Quagga.decodeSingle(
      {
        src,
        numOfWorkers: 0,
        locate: true,
        locator: locatorOptions,
        decoder: { readers: READERS }
      },
      (result) => resolve(result?.codeResult?.code ?? null)
    )
  })
}

// Maps the on-screen guide box (defined in container CSS fractions) into
// the video's native pixel coordinates, accounting for object-fit: cover
// scaling/cropping between the displayed element and the underlying stream.
function guideRectInVideoPixels(video, container) {
  const videoW = video.videoWidth
  const videoH = video.videoHeight
  const rect = container.getBoundingClientRect()
  const containerW = rect.width
  const containerH = rect.height

  const scale = Math.max(containerW / videoW, containerH / videoH)
  const displayedW = videoW * scale
  const displayedH = videoH * scale
  const offsetX = (displayedW - containerW) / 2
  const offsetY = (displayedH - containerH) / 2

  const leftDisplayed = GUIDE.xFrac * containerW + offsetX
  const topDisplayed = GUIDE.yFrac * containerH + offsetY
  const widthDisplayed = GUIDE.wFrac * containerW
  const heightDisplayed = GUIDE.hFrac * containerH

  return {
    x: leftDisplayed / scale,
    y: topDisplayed / scale,
    width: widthDisplayed / scale,
    height: heightDisplayed / scale
  }
}

function cropAndUpscale(video, rect) {
  const scaleUp = UPSCALED_WIDTH / rect.width
  const canvas = document.createElement('canvas')
  canvas.width = UPSCALED_WIDTH
  canvas.height = Math.round(rect.height * scaleUp)
  canvas
    .getContext('2d')
    .drawImage(video, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.95)
}

function fullFrame(video) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export default function BarcodeScanner({ collectionName, onProcess, processing }) {
  const [mode, setMode] = useState('bulk') // 'single' | 'bulk'
  const [queue, setQueue] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'analyzing' | 'not-found'
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setCameraReady(true)
      })
      .catch((err) => setError('Camera unavailable: ' + err.message))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function addCode(code) {
    if (mode === 'single') {
      setQueue([{ code, id: Date.now() }])
    } else {
      setQueue((prev) => [...prev, { code, id: Date.now() }])
    }
    setFlash(true)
    setTimeout(() => setFlash(false), 300)
    if (navigator.vibrate) navigator.vibrate(40)
    setStatus('idle')
  }

  async function capture() {
    const video = videoRef.current
    const container = containerRef.current
    if (!video || !video.videoWidth || !container) return

    setStatus('analyzing')

    const rect = guideRectInVideoPixels(video, container)
    const croppedSrc = cropAndUpscale(video, rect)

    // Try the cropped, upscaled guide-box region first — this is the shot
    // most likely to decode. Fall back to the full frame in case the
    // barcode wasn't well aligned in the guide but is still readable
    // elsewhere in frame.
    let code = await decodeOnce(croppedSrc, { patchSize: 'large', halfSample: false })
    if (!code) {
      code = await decodeOnce(fullFrame(video), { patchSize: 'medium', halfSample: true })
    }

    if (code) {
      addCode(code)
    } else {
      setStatus('not-found')
    }
  }

  function submitManual(e) {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    addCode(code)
    setManualCode('')
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

      <div ref={containerRef} className="relative rounded-xl2 overflow-hidden border border-charcoal-600">
        <video ref={videoRef} playsInline muted className="w-full aspect-[4/3] object-cover bg-black" />

        {/* Alignment guide — keep the barcode inside this box. Its position
            here (in %) mirrors the GUIDE fractions used for cropping. */}
        <div
          className="pointer-events-none absolute border-2 border-dashed border-mint-400/80 rounded-lg"
          style={{
            left: `${GUIDE.xFrac * 100}%`,
            top: `${GUIDE.yFrac * 100}%`,
            width: `${GUIDE.wFrac * 100}%`,
            height: `${GUIDE.hFrac * 100}%`
          }}
        />

        <div
          className={`pointer-events-none absolute inset-0 border-4 transition-opacity ${
            flash ? 'opacity-100 border-mint-400' : 'opacity-0 border-transparent'
          }`}
        />

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
          <span
            className={`flex-1 truncate text-xs rounded-full px-3 py-2 ${
              status === 'analyzing'
                ? 'bg-charcoal-900/80 text-mint-400'
                : status === 'not-found'
                ? 'bg-orange-500/80 text-charcoal-900 font-medium'
                : 'bg-charcoal-900/80 text-neutral-400'
            }`}
          >
            {status === 'analyzing'
              ? 'Analyzing…'
              : status === 'not-found'
              ? 'No barcode found — fill the box, hold steady, try again'
              : 'Fill the box with the barcode, then tap capture'}
          </span>

          <button
            onClick={capture}
            disabled={!cameraReady || status === 'analyzing'}
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

      <form onSubmit={submitManual} className="flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          inputMode="numeric"
          placeholder="Or type the barcode number"
          className="flex-1 bg-charcoal-800 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-mint-500"
        />
        <button
          type="submit"
          disabled={!manualCode.trim()}
          className="px-4 rounded-lg bg-charcoal-800 border border-charcoal-600 text-mint-400 text-sm font-medium disabled:text-neutral-600"
        >
          Add
        </button>
      </form>

      {queue.length > 0 && (
        <div className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-3">
          <p className="text-xs text-neutral-400 mb-2">
            {queue.length} captured{mode === 'single' ? ' (single mode replaces on next capture)' : ''}
          </p>
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
