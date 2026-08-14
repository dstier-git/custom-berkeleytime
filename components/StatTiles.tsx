interface Stats {
  total: number
  cleared: number
  heldForYou: number
  needsReview: number
  blocked: number
  unmet: number
}

/**
 * `personal` tiles only mean anything once a profile says who "you" are. Before
 * that they read as an em dash rather than a zero, which would claim that
 * nothing is cleared rather than that nothing has been checked.
 */
const TILES: { key: keyof Stats; label: string; cls: string; personal?: boolean }[] = [
  { key: 'total',       label: 'Courses',           cls: '' },
  { key: 'cleared',     label: 'Cleared for you',   cls: 'is-clear',   personal: true },
  { key: 'heldForYou',  label: 'Seats held for you', cls: 'is-gold',   personal: true },
  { key: 'needsReview', label: 'Needs review',      cls: 'is-review' },
  { key: 'blocked',     label: 'Other majors only', cls: 'is-blocked' },
  { key: 'unmet',       label: 'Prereqs unmet',     cls: 'is-blocked', personal: true },
]

export default function StatTiles({ stats, hasProfile = false }: { stats: Stats; hasProfile?: boolean }) {
  return (
    <div className="tiles">
      {TILES.map(t => {
        const unknown = t.personal && !hasProfile
        return (
          <div key={t.key} className={`tile ${unknown ? '' : t.cls}`.trim()}>
            <div className="n">{unknown ? '—' : stats[t.key]}</div>
            <div className="l">{t.label}</div>
          </div>
        )
      })}
    </div>
  )
}
