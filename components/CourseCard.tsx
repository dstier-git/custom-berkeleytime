'use client'

import { useState } from 'react'
import type { Course } from '@/lib/types'
import { severity, PREREQ_LABEL } from '@/lib/utils'
import SectionRow from './SectionRow'

const SEC_COLLAPSE = 3

interface CourseCardProps {
  course: Course
  tab: 'list' | 'trash'
  onAction: (course: Course) => void
}

export default function CourseCard({ course: c, tab, onAction }: CourseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const sev = severity(c)
  const pct = c.capacity ? Math.min(100, Math.round(c.enrolled / c.capacity * 100)) : 0
  const multi = c.sections.length > 1

  const badges: { cls: string; text: string }[] = []
  if (c.access === 'reserved_for_me') badges.push({ cls: 'b-gold', text: 'Held for you' })
  else if (c.access === 'open') badges.push({ cls: 'b-clear', text: 'Open' })
  else if (c.access === 'permission') badges.push({ cls: 'b-perm', text: 'Permission only' })
  else if (c.access === 'uncertain') badges.push({ cls: 'b-review', text: 'Eligibility unclear' })
  else badges.push({ cls: 'b-blocked', text: 'Other majors' })

  const pv = c.prereqVerdict
  const pcls = pv === 'MET' || pv === 'NONE' ? 'b-clear' : pv === 'REVIEW' ? 'b-review' : 'b-blocked'
  badges.push({ cls: pcls, text: PREREQ_LABEL[pv] })
  if (c.online) badges.push({ cls: 'b-plain', text: 'Online' })
  for (const b of c.breadth || []) badges.push({ cls: 'b-plain', text: b })

  const meta = [
    c.units != null ? <span key="units" className="mono">{c.units} units</span> : null,
    c.level ? <span key="level">{c.level}</span> : null,
    !multi && c.component ? <span key="comp">{c.component}</span> : null,
    !multi && c.instructors.length ? <span key="inst">{c.instructors.join(', ')}</span> : null,
    c.avgGrade != null ? <span key="grade" className="mono">avg {c.avgGrade.toFixed(2)}</span> : null,
    multi ? <span key="nsec" className="nsec">{c.sections.length} sections</span> : null,
  ].filter(Boolean)

  const s0 = c.sections[0]
  const visibleSections = expanded ? c.sections : c.sections.slice(0, SEC_COLLAPSE)
  const restCount = c.sections.length - SEC_COLLAPSE

  return (
    <article className={`course s-${sev}`} data-code={c.code}>
      <div className="gridrow">
        <div className="cell-main">
          <div className="codeline">
            <span className="code">
              <a href={c.url} target="_blank" rel="noopener noreferrer">{c.code}</a>
            </span>
            {!multi && <span className="sec">&sect;{s0.section}</span>}
          </div>
          <div className="title">{c.title}</div>
          {meta.length > 0 && <div className="metaline">{meta}</div>}
          <div className="badges">
            {badges.map((b, i) => (
              <span key={i} className={`badge ${b.cls}`}>{b.text}</span>
            ))}
          </div>
          {!multi && c.access !== 'open' && c.accessNote && (
            <p className="note">{c.accessNote}</p>
          )}
          {c.prereqText && (
            <p className="note prereq">Prereq: {c.prereqText}</p>
          )}
        </div>
        <div className="cell-seats">
          <div>
            <span className={`seatnum${c.openSeats ? '' : ' zero'}`}>{c.openSeats}</span>
            {' '}<span className="seatlabel">open</span>
          </div>
          <div className="meter">
            <i className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} />
          </div>
          <div className="seatsub">
            {c.enrolled}/{c.capacity} enrolled
            {c.waitlisted ? ` · ${c.waitlisted} wait` : ''}
          </div>
        </div>
        <div className="cell-when">
          {!multi && s0.meetings.length > 0 ? (
            <>
              {s0.meetings.map((m, i) => (
                <div key={i}>
                  <span className="d">{m.days || '—'}</span> {m.time}
                </div>
              ))}
              {s0.meetings[0].location && (
                <div style={{ marginTop: 3 }}>{s0.meetings[0].location}</div>
              )}
            </>
          ) : !multi ? (
            <div>No meeting pattern</div>
          ) : null}
        </div>
        <button
          className="xbtn"
          type="button"
          onClick={() => onAction(c)}
          title={tab === 'trash' ? 'Restore to shortlist' : 'Move to trash'}
          aria-label={`${tab === 'trash' ? 'Restore ' : 'Dismiss '}${c.code}`}
        >
          {tab === 'trash' ? '↩' : '×'}
        </button>
      </div>

      {multi && (
        <div className="sections">
          {visibleSections.map(s => (
            <SectionRow key={s.key} section={s} />
          ))}
          {!expanded && restCount > 0 && (
            <button
              className="moresec"
              type="button"
              onClick={() => setExpanded(true)}
            >
              Show {restCount} more section{restCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
