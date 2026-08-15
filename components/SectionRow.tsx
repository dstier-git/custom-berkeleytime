import type { TriageRow } from '@/lib/types'
import { rowDetailParts, seatLabel } from '@/lib/utils'

export default function SectionRow({ section: s }: { section: TriageRow }) {
  const seats = seatLabel(s.openSeats, s.enrolled, s.capacity, s.waitlisted)
  const detail = rowDetailParts({
    instructors: s.instructors,
    openSeats: s.openSeats,
    enrolled: s.enrolled,
    capacity: s.capacity,
    waitlisted: s.waitlisted,
    access: s.access,
    accessNote: s.accessNote,
    extra: s.component ? [s.component] : [],
  })

  return (
    <div className="gridrow srow" data-key={s.key}>
      <div className={`cell-seats${seats.wait ? ' wait' : ''}`}>{seats.text}</div>
      <div className="cell-main">
        <div className="titleline">
          <span className="secid">{s.section}</span>
          {s.online && <span className="title">Online</span>}
        </div>
      </div>
      <div className="cell-avg grade-none" />
      <div className="cell-when">
        {s.meetings.length ? (
          <>
            {s.meetings.map((m, i) => (
              <div key={i}>
                <span className="d">{m.days || '—'}</span> {m.time}
              </div>
            ))}
            {s.meetings[0].location && (
              <div className="when-loc">{s.meetings[0].location}</div>
            )}
          </>
        ) : (
          <div>{s.online ? 'Online' : 'No meeting pattern'}</div>
        )}
      </div>
      <div className="cell-action" />
      {detail && <div className="row-detail">{detail}</div>}
    </div>
  )
}
