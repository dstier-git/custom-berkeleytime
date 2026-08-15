'use client'

import { useState } from 'react'
import type { Course } from '@/lib/types'
import {
  formatUnits,
  gpaToLetter,
  gradeBand,
  prereqBadgeClass,
  prereqBadgeText,
  rowDetailParts,
  seatLabel,
} from '@/lib/utils'
import SectionRow from './SectionRow'

const SEC_COLLAPSE = 3

interface CourseCardProps {
  course: Course
  tab: 'list' | 'trash'
  onAction: (course: Course) => void
}

export default function CourseCard({ course: c, tab, onAction }: CourseCardProps) {
  const [expanded, setExpanded] = useState(false)
  const multi = c.sections.length > 1
  const s0 = c.sections[0]
  const visibleSections = expanded ? c.sections : c.sections.slice(0, SEC_COLLAPSE)
  const restCount = c.sections.length - SEC_COLLAPSE

  const units = formatUnits(c.units, c.unitsMin)
  const letter = c.avgGrade != null ? gpaToLetter(c.avgGrade) : null
  const seats = seatLabel(c.openSeats, c.enrolled, c.capacity, c.waitlisted)
  const detail = rowDetailParts({
    instructors: c.instructors,
    openSeats: c.openSeats,
    enrolled: c.enrolled,
    capacity: c.capacity,
    waitlisted: c.waitlisted,
    access: c.access,
    accessNote: c.accessNote,
    extra: multi ? [`${c.sections.length} sections`] : [],
  })

  const meetings = s0?.meetings ?? []
  const whenEmpty = meetings.length === 0

  return (
    <article className="course" data-code={c.code}>
      <div className="gridrow">
        <div className={`cell-seats${seats.wait ? ' wait' : ''}`}>{seats.text}</div>
        <div className="cell-main">
          <div className="titleline">
            <span className="code">
              <a href={c.url} target="_blank" rel="noopener noreferrer">{c.code}</a>
            </span>
            <span className="title">{c.title}</span>
          </div>
          <div className="pills">
            {units && <span className="pill pill-quiet">{units}</span>}
            <span className={`pill ${prereqBadgeClass(c.prereqVerdict)}`}>
              {prereqBadgeText(c.prereqVerdict, c.prereqText)}
            </span>
          </div>
        </div>
        <div className={`cell-avg${letter ? ` grade-${gradeBand(letter)}` : ' grade-none'}`}>
          {letter ?? '—'}
        </div>
        <div className="cell-when">
          {meetings.length > 0 ? (
            <>
              {meetings.map((m, i) => (
                <div key={i}>
                  <span className="d">{m.days || '—'}</span> {m.time}
                </div>
              ))}
              {meetings[0].location && (
                <div className="when-loc">{meetings[0].location}</div>
              )}
            </>
          ) : whenEmpty ? (
            <div>{c.online ? 'Online' : 'No meeting pattern'}</div>
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
        {detail && <div className="row-detail">{detail}</div>}
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
