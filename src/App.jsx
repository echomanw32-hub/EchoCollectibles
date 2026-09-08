import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import CollectionManager from './components/CollectionManager'
import BarcodeScanner from './components/BarcodeScanner'
import ReviewQueue from './components/ReviewQueue'
import Dashboard from './components/Dashboard'
import InstallPrompt from './components/InstallPrompt'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'collections', label: 'Collections', icon: '🗂️' },
  { id: 'scan', label: 'Scan', icon: '📷' }
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [collections, setCollections] = useState([])
  const [items, setItems] = useState([])
  const [selectedCollectionId, setSelectedCollectionId] = useState(null)
  const [pendingReview, setPendingReview] = useState(null) // { collection, results }
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const {
      data: { session }
    } = await supabase.auth.getSession()

    let uid = session?.user?.id
    if (!uid) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error('Auth error', error)
        return
      }
      uid = data.user.id
    }
    setUserId(uid)
    await loadData(uid)
  }

  async function loadData(uid) {
    const [{ data: cols }, { data: its }] = await Promise.all([
      supabase.from('collections').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('items').select('*').eq('user_id', uid).order('created_at', { ascending: false })
    ])
    setCollections(cols ?? [])
    setItems(its ?? [])
    if (!selectedCollectionId && cols?.length) setSelectedCollectionId(cols[0].id)
  }

  async function createCollection({ name, color, icon }) {
    const { data, error } = await supabase
      .from('collections')
      .insert({ user_id: userId, name, color, icon })
      .select()
      .single()
    if (error) return console.error(error)
    setCollections((prev) => [...prev, data])
    setSelectedCollectionId(data.id)
  }

  async function processBarcodes(barcodes) {
    setProcessing(true)
    try {
      const res = await fetch('/api/price/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcodes })
      })
      const { results } = await res.json()
      const collection = collections.find((c) => c.id === selectedCollectionId)
      setPendingReview({
        collection,
        results: results.map((r) => ({
          barcode: r.barcode,
          title: r.title ?? r.barcode,
          imageUrl: r.imageUrl,
          marketValue: r.marketValue ?? 0,
          found: r.found
        }))
      })
    } catch (err) {
      console.error('Bulk price fetch failed', err)
    } finally {
      setProcessing(false)
    }
  }

  async function saveReviewed(drafts) {
    setSaving(true)
    const rows = drafts.map((d) => ({
      user_id: userId,
      collection_id: selectedCollectionId,
      barcode: d.barcode,
      title: d.title,
      image_url: d.imageUrl,
      market_value: d.marketValue
    }))
    const { data, error } = await supabase.from('items').insert(rows).select()
    setSaving(false)
    if (error) return console.error(error)
    setItems((prev) => [...(data ?? []), ...prev])
    setPendingReview(null)
    setTab('dashboard')
  }

  const collectionsWithCounts = collections.map((c) => ({
    ...c,
    itemCount: items.filter((it) => it.collection_id === c.id).length
  }))
  const selectedCollection = collections.find((c) => c.id === selectedCollectionId)

  return (
    <div className="min-h-screen bg-charcoal-900 flex flex-col">
      <header className="px-5 pt-6 pb-3">
        <h1 className="text-xl font-bold text-neutral-100">
          Echo<span className="text-mint-400">Collectibles</span>
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-28">
        {pendingReview ? (
          <ReviewQueue
            items={pendingReview.results}
            collection={pendingReview.collection}
            onSave={saveReviewed}
            onDiscard={() => setPendingReview(null)}
            saving={saving}
          />
        ) : tab === 'dashboard' ? (
          <Dashboard collections={collectionsWithCounts} items={items} />
        ) : tab === 'collections' ? (
          <CollectionManager
            collections={collectionsWithCounts}
            onCreate={createCollection}
            onSelect={setSelectedCollectionId}
            selectedId={selectedCollectionId}
          />
        ) : (
          <BarcodeScanner
            collectionName={selectedCollection?.name ?? 'No collection selected'}
            onProcess={processBarcodes}
            processing={processing}
          />
        )}
      </main>

      {!pendingReview && (
        <nav className="fixed bottom-0 inset-x-0 bg-charcoal-800/95 backdrop-blur border-t border-charcoal-600 flex pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs ${
                tab === t.id ? 'text-mint-400' : 'text-neutral-500'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <InstallPrompt />
    </div>
  )
}
