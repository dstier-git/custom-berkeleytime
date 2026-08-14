import type { TriageRow } from '@/lib/types'

export default function SectionRow({ section: s }: { section: TriageRow }) {
  const pct = s.capacity ? Math.min(100, Math.round(s.enrolled / s.capacity * 100)) : 0

  const meta = [
    s.component,
    s.instructors.length ? s.instructors.join(', ') : null,
  ].filter(Boolean)

  const badges: { cls: string; text: string }[] = []
  if (s.access === 'reserved_for_me') badges.push({ cls: 'b-gold', text: 'Held for you' })
  else if (s.access === 'permission') badges.push({ cls: 'b-perm', text: 'Permission' })
  else if (s.access === 'uncertain') badges.push({ cls: 'b-review', text: 'Eligibility unclear' })
  else if (s.access === 'blocked') badges.push({ cls: 'b-blocked', text: 'Other majors' })
  if (s.online) badges.push({ cls: 'b-plain', text: 'Online' })

  return (
    <div className="gridrow srow" data-key={s.key}>
      <div className="cell-main">
        <span className="secid">{s.section}</span>
        {meta.length > 0 && (
          <div className="metaline">
            {meta.map((m, i) => <span key={i}>{m}</span>)}
          </div>
        )}
        {badges.length > 0 && (
          <div className="badges">
            {badges.map((b, i) => (
              <span key={i} className={`badge ${b.cls}`}>{b.text}</span>
            ))}
          </div>
        )}
        {s.accessNote && s.access !== 'open' && (
          <p className="note">{s.accessNote}</p>
        )}
      </div>
      <div className="cell-seats">
        <div>
          <span className={`seatnum${s.openSeats ? '' : ' zero'}`}>{s.openSeats}</span>
          {' '}<span className="seatlabel">open</span>
        </div>
        <div className="meter">
          <i className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} />
        </div>
        <div className="seatsub">
          {s.enrolled}/{s.capacity} enrolled
          {s.waitlisted ? ` · ${s.waitlisted} wait` : ''}
        </div>
      </div>
      <div className="cell-when">
        {s.meetings.length ? (
          <>
            {s.meetings.map((m, i) => (
              <div key={i}>
                <span className="d">{m.days || '—'}</span> {m.time}
              </div>
            ))}
            {s.meetings[0].location && (
              <div style={{ marginTop: 3 }}>{s.meetings[0].location}</div>
            )}
          </>
        ) : (
          <div>No meeting pattern</div>
        )}
      </div>
      <div />
    </div>
  )
}
