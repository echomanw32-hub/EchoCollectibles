export default function Dashboard({ collections, items }) {
  const totalCount = items.length
  const totalValue = items.reduce((sum, it) => sum + (it.market_value ?? 0), 0)

  const byCollection = collections.map((c) => {
    const collItems = items.filter((it) => it.collection_id === c.id)
    return {
      ...c,
      count: collItems.length,
      value: collItems.reduce((sum, it) => sum + (it.market_value ?? 0), 0)
    }
  })

  const topCategory = byCollection.reduce(
    (top, c) => (c.value > (top?.value ?? -1) ? c : top),
    null
  )

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-100">Dashboard</h2>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Total collectibles" value={totalCount} />
        <Metric label="Portfolio value" value={`$${totalValue.toFixed(2)}`} accent />
        <div className="col-span-2 rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-4">
          <p className="text-xs text-neutral-500 mb-1">Top performing category</p>
          {topCategory ? (
            <div className="flex items-center gap-2">
              <span className="text-xl">{topCategory.icon}</span>
              <span className="font-medium text-neutral-100">{topCategory.name}</span>
              <span className="ml-auto text-mint-400 font-semibold">${topCategory.value.toFixed(2)}</span>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No items yet</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-neutral-400 font-medium">By collection</p>
        {byCollection.map((c) => (
          <div
            key={c.id}
            className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-3 flex items-center gap-3"
          >
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-lg shrink-0"
              style={{ backgroundColor: c.color + '33' }}
            >
              {c.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-100 truncate">{c.name}</p>
              <p className="text-xs text-neutral-500">{c.count} items</p>
            </div>
            <p className="font-semibold text-mint-400">${c.value.toFixed(2)}</p>
          </div>
        ))}
        {byCollection.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-6">Create a collection to see it here.</p>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-xl2 bg-charcoal-800 border border-charcoal-600 p-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-mint-400' : 'text-neutral-100'}`}>{value}</p>
    </div>
  )
}
