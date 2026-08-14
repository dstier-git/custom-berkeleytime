import type { Course, FilterState, ScheduleBlock, SortDef, TriageRow } from './types'

export const ACCESS_LABEL: Record<string, string> = {
  open:            'Open to anyone',
  reserved_for_me: 'Held for you',
  permission:      'Permission only',
  uncertain:       'Eligibility unclear',
  blocked:         'Held for other majors',
}

export const PREREQ_LABEL: Record<string, string> = {
  NONE:    'No prereqs',
  MET:     'Prereqs met',
  REVIEW:  'Needs review',
  NOT_MET: 'Prereqs unmet',
}

export const ACCESS_RANK: Record<string, number> = {
  open: 0,
  reserved_for_me: 1,
  uncertain: 2,
  permission: 3,
  blocked: 4,
}

export const UNIT_BUCKETS = ['1', '2', '3', '4', '5+'] as const

export function unitBucket(u: number | null): string {
  if (u == null || u <= 1) return '1'
  if (u <= 2) return '2'
  if (u <= 3) return '3'
  if (u <= 4) return '4'
  return '5+'
}

export const LANG_SUBJECTS = new Set([
  'ARABIC','ARMENI','BANGLA','BOSCRSR','BURMESE','CATALAN','CHINESE','CUNEIF',
  'DANISH','DUTCH','FILIPN','FINNISH','FRENCH','GERMAN','GREEK','HEBREW',
  'HINDI','HUNGARI','INDONES','ITALIAN','JAPAN','KOREAN','LATIN','MDGRK',
  'MONGOLN','NORWEGN','PERSIAN','POLISH','PORTUG','PUNJABI','RUSSIAN',
  'SANSKR','SLAVIC','SPANISH','SWEDISH','TAMIL','TELUGU','THAI','TIBETAN',
  'TURKISH','UKRAINI','URDU','VIETNMS','YIDDISH',
])

export function bestAccess(secs: TriageRow[]): TriageRow['access'] {
  let best: TriageRow['access'] = 'blocked'
  for (const r of secs) {
    if (ACCESS_RANK[r.access] < ACCESS_RANK[best]) best = r.access
  }
  return best
}

export function bestAccessNote(secs: TriageRow[]): string {
  const ba = bestAccess(secs)
  const sec = secs.find(r => r.access === ba)
  return sec ? sec.accessNote : ''
}

export function severity(r: Course): 'clear' | 'review' | 'blocked' | 'perm' {
  if (r.access === 'blocked' || r.prereqVerdict === 'NOT_MET') return 'blocked'
  if (r.access === 'permission') return 'perm'
  if (r.access === 'uncertain' || r.prereqVerdict === 'REVIEW') return 'review'
  return 'clear'
}

export function isCleared(r: Course): boolean {
  return (
    (r.access === 'open' || r.access === 'reserved_for_me') &&
    (r.prereqVerdict === 'NONE' || r.prereqVerdict === 'MET')
  )
}

const haystackCache = new WeakMap<Course, string>()

export function haystack(r: Course): string {
  const cached = haystackCache.get(r)
  if (cached) return cached
  const h = [
    r.code, r.title, r.subject, r.department,
    r.instructors.join(' '), r.description, r.prereqText,
    ...r.sections.flatMap(s => s.instructors),
  ].join(' ').toLowerCase()
  haystackCache.set(r, h)
  return h
}

export const DAY_ABB = ['Mo', 'Tu', 'We', 'Th', 'Fr'] as const

export const DAY_FULL: Record<string, string> = {
  Mo: 'M', Tu: 'Tu', We: 'W', Th: 'Th', Fr: 'F',
}

export function overlapsDays(meetDays: string | null, blockDays: Set<string>): boolean {
  if (!meetDays) return false
  for (let i = 0; i < meetDays.length; i += 2) {
    if (blockDays.has(meetDays.slice(i, i + 2))) return true
  }
  return false
}

export function sectionConflicts(s: TriageRow, activeBlocks: ScheduleBlock[]): boolean {
  return s.meetings.some(m => {
    if (m.startMinutes == null || m.endMinutes == null) return false
    return activeBlocks.some(b =>
      overlapsDays(m.days, b.days) &&
      m.startMinutes! < b.endMin && m.endMinutes! > b.startMin
    )
  })
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  const ap = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')}${ap}`
}

export function fmtBlockTime(b: ScheduleBlock): string {
  const ds = DAY_ABB.filter(d => b.days.has(d)).map(d => DAY_FULL[d]).join('')
  return `${ds} ${fmtMinutes(b.startMin)}–${fmtMinutes(b.endMin)}`
}

export function buildCourses(rows: TriageRow[]): Course[] {
  const m = new Map<string, TriageRow[]>()
  for (const r of rows) {
    if (!m.has(r.code)) m.set(r.code, [])
    m.get(r.code)!.push(r)
  }
  const courses: Course[] = [...m.entries()].map(([code, secs]) => {
    const rep = secs[0]
    const rawEarliest = secs.reduce(
      (min, r) => r.earliestStart != null && r.earliestStart < min ? r.earliestStart : min,
      Infinity,
    )
    return {
      code,
      subject: rep.subject,
      courseNumber: rep.courseNumber,
      title: rep.title,
      description: rep.description,
      level: rep.level,
      units: rep.units,
      unitsMin: rep.unitsMin,
      component: rep.component,
      gradingBasis: rep.gradingBasis,
      department: rep.department,
      breadth: rep.breadth,
      universityReqs: rep.universityReqs,
      avgGrade: rep.avgGrade,
      prereqVerdict: rep.prereqVerdict,
      prereqSource: rep.prereqSource,
      prereqText: rep.prereqText,
      url: rep.url,
      online: secs.some(r => r.online),
      sections: secs,
      openSeats: secs.reduce((s, r) => s + r.openSeats, 0),
      enrolled: secs.reduce((s, r) => s + r.enrolled, 0),
      capacity: secs.reduce((s, r) => s + r.capacity, 0),
      waitlisted: secs.reduce((s, r) => s + r.waitlisted, 0),
      waitlistMax: secs.reduce((s, r) => s + r.waitlistMax, 0),
      instructors: [...new Set(secs.flatMap(r => r.instructors))],
      access: bestAccess(secs),
      accessNote: bestAccessNote(secs),
      earliestStart: Number.isFinite(rawEarliest) ? rawEarliest : null,
    }
  })
  return courses
}

export const SORTS: SortDef[] = [
  { k: 'code',          label: 'Code',       get: r => r.code },
  { k: 'title',         label: 'Title',      get: r => r.title.toLowerCase() },
  { k: 'openSeats',     label: 'Open seats', get: r => r.openSeats, num: true, desc: true },
  { k: 'fill',          label: 'Fullness',   get: r => r.capacity ? r.enrolled / r.capacity : 0, num: true },
  { k: 'capacity',      label: 'Capacity',   get: r => r.capacity, num: true, desc: true },
  { k: 'waitlisted',    label: 'Waitlist',   get: r => r.waitlisted, num: true },
  { k: 'units',         label: 'Units',      get: r => r.units ?? 0, num: true, desc: true },
  { k: 'level',         label: 'Level',      get: r => r.level || '' },
  { k: 'avgGrade',      label: 'Avg grade',  get: r => r.avgGrade ?? -1, num: true, desc: true },
  { k: 'earliestStart', label: 'Start time', get: r => r.earliestStart ?? 1e9, num: true },
  { k: 'subject',       label: 'Subject',    get: r => r.subject },
]

/**
 * With a profile loaded, the useful default is "hide what you can't take".
 * Without one nothing has been judged — every row is `uncertain`/`REVIEW` — so
 * the same defaults would hide the entire catalog. Empty sets mean no filtering.
 */
export function createDefaultFilters(hasProfile = false): FilterState {
  return {
    q: '',
    subject: new Set(),
    breadth: new Set(),
    day: new Set(),
    units: new Set(),
    access: new Set(hasProfile ? ['open', 'reserved_for_me'] : []),
    prereq: new Set(hasProfile ? ['NONE', 'MET'] : []),
    level: new Set(),
    misc: new Set(),
  }
}
