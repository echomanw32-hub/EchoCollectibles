import { useEffect, useState } from 'react'

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function InstallPrompt() {
  const [showIosTip, setShowIosTip] = useState(false)
  const [androidEvent, setAndroidEvent] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem('ec-install-dismissed') === '1') return

    if (isIos()) {
      setShowIosTip(true)
    }

    function onBeforeInstall(e) {
      e.preventDefault()
      setAndroidEvent(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function dismiss() {
    localStorage.setItem('ec-install-dismissed', '1')
    setDismissed(true)
  }

  async function installAndroid() {
    if (!androidEvent) return
    androidEvent.prompt()
    await androidEvent.userChoice
    setAndroidEvent(null)
  }

  if (dismissed || (!showIosTip && !androidEvent)) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📲</span>
        <div className="flex-1 min-w-0">
          {androidEvent ? (
            <>
              <p className="text-sm font-medium text-neutral-100">Install EchoCollectibles</p>
              <p className="text-xs text-neutral-400 mt-0.5">Add it to your home screen for the full app experience.</p>
              <button
                onClick={installAndroid}
                className="mt-3 w-full bg-mint-500 text-charcoal-900 text-sm font-semibold rounded-lg py-2 active:scale-95 transition"
              >
                Install
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-100">Add to Home Screen</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Tap the Share icon <span className="font-mono">⬆️</span> below, then choose{' '}
                <span className="text-mint-400">Add to Home Screen</span>.
              </p>
            </>
          )}
        </div>
        <button onClick={dismiss} className="text-neutral-500 text-lg leading-none">
          ×
        </button>
      </div>
    </div>
  )
}
