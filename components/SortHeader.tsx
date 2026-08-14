import { SORTS } from '@/lib/utils'

interface SortHeaderProps {
  sortKey: string
  sortDir: number
  setSort: (key: string) => void
}

export default function SortHeader({ sortKey, sortDir, setSort }: SortHeaderProps) {
  return (
    <div className="sorthead">
      <span
        className="glabel"
        style={{
          fontFamily: 'var(--mono)',
          fontSize: '10px',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color: 'var(--faint)',
          marginRight: '4px',
        }}
      >
        Sort
      </span>
      {SORTS.map(s => {
        const active = s.k === sortKey
        return (
          <button
            key={s.k}
            className="sortbtn"
            type="button"
            aria-pressed={active}
            onClick={() => setSort(s.k)}
          >
            {s.label}
            <span className="dir">
              {active ? (sortDir === 1 ? '↑' : '↓') : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}
