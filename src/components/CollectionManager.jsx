import { useState } from 'react'

const SWATCHES = ['#5eead4', '#f472b6', '#facc15', '#93c5fd', '#fb923c', '#c4b5fd']
const ICONS = ['📦', '🃏', '📚', '🎮', '🧸', '🪙', '👟', '💿']

export default function CollectionManager({ collections, onCreate, onSelect, selectedId }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[0])
  const [icon, setIcon] = useState(ICONS[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), color, icon })
      setName('')
      setColor(SWATCHES[0])
      setIcon(ICONS[0])
      setCreating(false)
    } catch (err) {
      setError(err.message || 'Could not create collection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Collections</h2>
        <button
          onClick={() => setCreating((v) => !v)}
          className="rounded-full bg-mint-500/15 text-mint-400 text-sm font-medium px-4 py-2 active:scale-95 transition"
        >
          {creating ? 'Cancel' : '+ New collection'}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-4 space-y-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Funko Pops"
            className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-mint-500"
          />

          <div>
            <p className="text-xs text-neutral-400 mb-2">Icon</p>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`h-10 w-10 rounded-lg text-lg flex items-center justify-center border ${
                    icon === i ? 'border-mint-400 bg-mint-500/10' : 'border-charcoal-600 bg-charcoal-900'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-neutral-400 mb-2">Color tag</p>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-full border-2 ${
                    color === c ? 'border-neutral-100' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-mint-500 disabled:bg-charcoal-600 disabled:text-neutral-500 text-charcoal-900 font-semibold rounded-lg py-2.5 active:scale-95 transition"
          >
            {submitting ? 'Creating…' : 'Create collection'}
          </button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3">
        {collections.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`rounded-xl2 p-4 text-left border transition ${
              selectedId === c.id
                ? 'border-mint-400 bg-mint-500/10'
                : 'border-charcoal-600 bg-charcoal-800'
            }`}
          >
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-lg mb-3"
              style={{ backgroundColor: c.color + '33' }}
            >
              {c.icon}
            </div>
            <p className="font-medium text-neutral-100 truncate">{c.name}</p>
            <p className="text-xs text-neutral-500">{c.itemCount ?? 0} items</p>
          </button>
        ))}
        {collections.length === 0 && (
          <p className="col-span-2 text-sm text-neutral-500 py-6 text-center">
            No collections yet — create one to start scanning.
          </p>
        )}
      </div>
    </div>
  )
}
