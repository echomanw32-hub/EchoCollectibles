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

export default function BarcodeScanner({ collectionName, onProcess, processing }) {
  const [mode, setMode] = useState('bulk') // 'single' | 'bulk'
  const [queue, setQueue] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'analyzing' | 'not-found'
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [manualCode, setManualCode] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
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

  function captureFrame() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  function capture() {
    const dataUrl = captureFrame()
    if (!dataUrl) return
    setStatus('analyzing')

    Quagga.decodeSingle(
      {
        src: dataUrl,
        numOfWorkers: 0,
        locate: true,
        decoder: { readers: READERS }
      },
      (result) => {
        const code = result?.codeResult?.code
        if (code) {
          addCode(code)
        } else {
          setStatus('not-found')
        }
      }
    )
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

      <div className="relative rounded-xl2 overflow-hidden border border-charcoal-600">
        <video ref={videoRef} playsInline muted className="w-full aspect-[4/3] object-cover bg-black" />

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
              ? 'No barcode found — reposition and try again, or enter manually below'
              : 'Line up the barcode, then tap capture'}
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
