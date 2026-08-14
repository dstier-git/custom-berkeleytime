/**
 * Shaping a raw Berkeleytime class into the fields the interface renders.
 *
 * Shared by the profiled build (build-dataset.mjs) and the neutral build
 * (build-neutral-dataset.mjs) so the two datasets can only ever differ in the
 * verdicts, never in the underlying class facts.
 */

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

const hhmm = (t) => {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')}${ampm}`
}

export function formatMeetings(meetings) {
  return (meetings ?? [])
    .map((m) => {
      const days = (m.days ?? []).map((on, i) => (on ? DAY_NAMES[i] : null)).filter(Boolean).join('')
      const t = m.startTime && m.endTime ? `${hhmm(m.startTime)}–${hhmm(m.endTime)}` : ''
      return {
        days,
        time: t,
        startMinutes: m.startTime ? toMinutes(m.startTime) : null,
        endMinutes: m.endTime ? toMinutes(m.endTime) : null,
        location: m.location ?? '',
        instructors: (m.instructors ?? [])
          .map((i) => [i.givenName, i.familyName].filter(Boolean).join(' '))
          .filter(Boolean),
      }
    })
    .filter((m) => m.days || m.time || m.instructors.length)
}

/** classes.berkeley.edu detail slug, for verifying a class against the source. */
export function sourceUrl(c) {
  const seg = [
    `${c.year}-fall`,
    c.subject.toLowerCase().replace(/[^a-z0-9]/g, ''),
    String(c.courseNumber).toLowerCase(),
    String(c.number).toLowerCase(),
    String(c.primaryComponent ?? 'lec').toLowerCase(),
    String(c.number).toLowerCase(),
  ]
  return `https://classes.berkeley.edu/content/${seg.join('-')}`
}

/**
 * Every field of a row that does not depend on who the student is. The caller
 * adds the verdicts (access / prereq).
 */
export function classFacts(c, key) {
  const meetings = formatMeetings(c.meetings)
  const instructors = [...new Set(meetings.flatMap((m) => m.instructors))]
  const earliestStart = meetings.reduce(
    (min, m) => (m.startMinutes != null && m.startMinutes < min ? m.startMinutes : min),
    Infinity,
  )

  return {
    key,
    code: `${c.subject} ${c.courseNumber}`,
    subject: c.subject,
    courseNumber: c.courseNumber,
    section: c.number,
    title: c.courseTitle ?? c.title ?? '',
    description: (c.courseDescription ?? c.description ?? '').slice(0, 600),
    level: c.level,
    units: c.unitsMax ?? c.unitsMin ?? null,
    unitsMin: c.unitsMin ?? null,
    component: c.primaryComponent,
    online: !!c.primaryOnline,
    gradingBasis: c.gradingBasis ?? '',
    department: c.academicOrganizationName ?? '',
    breadth: c.breadthRequirements ?? [],
    universityReqs: c.universityRequirements ?? [],
    avgGrade: c.allTimeAverageGrade ?? null,
    enrolled: c.enrolledCount ?? 0,
    capacity: c.maxEnroll ?? 0,
    openSeats: c.openSeats ?? 0,
    waitlisted: c.waitlistedCount ?? 0,
    waitlistMax: c.maxWaitlist ?? 0,
    instructors,
    meetings,
    earliestStart: Number.isFinite(earliestStart) ? earliestStart : null,
    url: sourceUrl(c),
  }
}
