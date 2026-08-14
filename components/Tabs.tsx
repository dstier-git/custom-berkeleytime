interface TabsProps {
  tab: 'list' | 'trash'
  setTab: (t: 'list' | 'trash') => void
  listCount: number
  trashCount: number
}

export default function Tabs({ tab, setTab, listCount, trashCount }: TabsProps) {
  return (
    <div className="tabs" role="tablist">
      <button
        className="tab"
        role="tab"
        type="button"
        aria-selected={tab === 'list'}
        onClick={() => setTab('list')}
      >
        Shortlist <span className="count">{listCount}</span>
      </button>
      <button
        className="tab"
        role="tab"
        type="button"
        aria-selected={tab === 'trash'}
        onClick={() => setTab('trash')}
      >
        Trash <span className="count">{trashCount}</span>
      </button>
    </div>
  )
}
