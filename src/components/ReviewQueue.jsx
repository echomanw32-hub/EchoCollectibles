import { useState } from 'react'

export default function ReviewQueue({ items, collection, onSave, onDiscard, saving }) {
  const [drafts, setDrafts] = useState(() =>
    items.map((it) => ({ ...it, title: it.title ?? it.barcode, marketValue: it.marketValue ?? 0 }))
  )

  function update(index, field, value) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)))
  }

  function removeDraft(index) {
    setDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-100">Review</h2>
        <p className="text-xs text-neutral-500">
          {drafts.length} item{drafts.length === 1 ? '' : 's'} for {collection?.name}
        </p>
      </div>

      <div className="space-y-3">
        {drafts.map((item, i) => (
          <div key={item.barcode + i} className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-3 flex gap-3">
            <div className="h-20 w-20 shrink-0 rounded-lg bg-charcoal-900 overflow-hidden flex items-center justify-center">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">{collection?.icon ?? '📦'}</span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                value={item.title}
                onChange={(e) => update(i, 'title', e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-neutral-100 outline-none border-b border-transparent focus:border-mint-500"
              />
              <p className="text-xs text-neutral-500">Barcode: {item.barcode}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-mint-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={item.marketValue}
                  onChange={(e) => update(i, 'marketValue', parseFloat(e.target.value) || 0)}
                  className="w-24 bg-charcoal-900 border border-charcoal-600 rounded px-2 py-1 text-sm text-neutral-100 outline-none focus:border-mint-500"
                />
                {item.found === false && (
                  <span className="text-[11px] text-orange-400">no listing found</span>
                )}
              </div>
            </div>

            <button
              onClick={() => removeDraft(i)}
              className="self-start h-6 w-6 rounded-full bg-charcoal-900 text-neutral-400 flex items-center justify-center shrink-0"
            >
              ×
            </button>
          </div>
        ))}
        {drafts.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-6">Nothing left to review.</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onDiscard}
          className="flex-1 rounded-lg py-3 border border-charcoal-600 text-neutral-300 font-medium active:scale-95 transition"
        >
          Discard
        </button>
        <button
          onClick={() => onSave(drafts)}
          disabled={drafts.length === 0 || saving}
          className="flex-1 rounded-lg py-3 bg-mint-500 disabled:bg-charcoal-600 disabled:text-neutral-500 text-charcoal-900 font-semibold active:scale-95 transition"
        >
          {saving ? 'Saving…' : `Save ${drafts.length}`}
        </button>
      </div>
    </div>
  )
}
