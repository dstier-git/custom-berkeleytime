import { useMemo } from 'react'
import type { Course, FilterState } from '@/lib/types'
import { ACCESS_LABEL, PREREQ_LABEL, UNIT_BUCKETS, unitBucket } from '@/lib/utils'
import DropdownMultiSelect from './DropdownMultiSelect'

interface ControlsBarProps {
  filters: FilterState
  setFilter: (key: keyof FilterState, value: unknown) => void
  toggleChip: (group: 'access' | 'prereq' | 'level' | 'misc', value: string) => void
  resetFilters: () => void
  courses: Course[]
}

const MISC_CHIPS: [string, string][] = [
  ['online', 'Online'],
  ['nowait', 'No waitlist'],
  ['graded', 'Letter graded'],
  ['breadth', 'Fills a breadth'],
  ['lang', 'Language'],
]

const DAY_LABELS: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday',
  Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
}

const UNIT_LABELS: Record<string, string> = {
  '1': '1 unit', '2': '2 units', '3': '3 units', '4': '4 units', '5+': '5+ units',
}

const ALL_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function ControlsBar({
  filters, setFilter, toggleChip, resetFilters, courses,
}: ControlsBarProps) {
  const subjectItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) counts.set(c.subject, (counts.get(c.subject) || 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([s, n]) => ({ value: s, label: s, count: n }))
  }, [courses])

  const breadthItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) {
      for (const b of c.breadth || []) counts.set(b, (counts.get(b) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([b, n]) => ({ value: b, label: b, count: n }))
  }, [courses])

  const dayItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of ALL_DAYS) counts.set(d, 0)
    for (const c of courses) {
      for (const s of c.sections) {
        for (const m of s.meetings) {
          if (!m.days) continue
          for (const d of ALL_DAYS) {
            if (m.days.includes(d)) counts.set(d, (counts.get(d) || 0) + 1)
          }
        }
      }
    }
    return ALL_DAYS.map(d => ({ value: d, label: DAY_LABELS[d], count: counts.get(d) || 0 }))
  }, [courses])

  const unitItems = useMemo(() => {
    const counts = new Map<string, number>()
    for (const u of UNIT_BUCKETS) counts.set(u, 0)
    for (const c of courses) {
      const b = unitBucket(c.units)
      counts.set(b, (counts.get(b) || 0) + 1)
    }
    return UNIT_BUCKETS.map(u => ({ value: u, label: UNIT_LABELS[u], count: counts.get(u) || 0 }))
  }, [courses])

  const accessCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const k of Object.keys(ACCESS_LABEL)) counts[k] = 0
    for (const c of courses) counts[c.access] = (counts[c.access] || 0) + 1
    return counts
  }, [courses])

  const prereqCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const k of Object.keys(PREREQ_LABEL)) counts[k] = 0
    for (const c of courses) counts[c.prereqVerdict] = (counts[c.prereqVerdict] || 0) + 1
    return counts
  }, [courses])

  const levels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of courses) {
      if (c.level) counts.set(c.level, (counts.get(c.level) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [courses])

  return (
    <div className="controls">
      <div className="searchrow">
        <div className="search">
          <input
            type="search"
            placeholder="Search code, title, instructor, department, description…"
            autoComplete="off"
            value={filters.q}
            onChange={e => setFilter('q', e.target.value)}
          />
        </div>
        <DropdownMultiSelect
          label="subjects"
          items={subjectItems}
          selected={filters.subject}
          onChange={s => setFilter('subject', s)}
          searchable
        />
        <DropdownMultiSelect
          label="breadths"
          items={breadthItems}
          selected={filters.breadth}
          onChange={s => setFilter('breadth', s)}
          searchable
        />
        <DropdownMultiSelect
          label="days"
          items={dayItems}
          selected={filters.day}
          onChange={s => setFilter('day', s)}
          width={170}
        />
        <DropdownMultiSelect
          label="units"
          items={unitItems}
          selected={filters.units}
          onChange={s => setFilter('units', s)}
          width={170}
        />
        <button className="mini" type="button" onClick={resetFilters}>
          Reset filters
        </button>
      </div>

      <div className="chiprow">
        <div className="chipgroup">
          <span className="glabel">Seats</span>
          {Object.entries(ACCESS_LABEL).map(([k, label]) => (
            <button
              key={k}
              className="chip"
              type="button"
              aria-pressed={filters.access.has(k)}
              onClick={() => toggleChip('access', k)}
            >
              {label}
              <span className="c">{accessCounts[k] || 0}</span>
            </button>
          ))}
        </div>
        <div className="chipgroup">
          <span className="glabel">Prereqs</span>
          {Object.entries(PREREQ_LABEL).map(([k, label]) => (
            <button
              key={k}
              className="chip"
              type="button"
              aria-pressed={filters.prereq.has(k)}
              onClick={() => toggleChip('prereq', k)}
            >
              {label}
              <span className="c">{prereqCounts[k] || 0}</span>
            </button>
          ))}
        </div>
        <div className="chipgroup">
          <span className="glabel">Level</span>
          {levels.map(([level, count]) => (
            <button
              key={level}
              className="chip"
              type="button"
              aria-pressed={filters.level.has(level)}
              onClick={() => toggleChip('level', level)}
            >
              {level}
              <span className="c">{count}</span>
            </button>
          ))}
        </div>
        <div className="chipgroup">
          <span className="glabel">Only</span>
          {MISC_CHIPS.map(([v, label]) => (
            <button
              key={v}
              className="chip"
              type="button"
              aria-pressed={filters.misc.has(v)}
              onClick={() => toggleChip('misc', v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
