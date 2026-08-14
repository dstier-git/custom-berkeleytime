/**
 * Step 4 — join catalog + reservations + prerequisites into the dataset the
 * interface renders.
 *
 * Output: data/fall2026-triage.json
 */

import { readFile, writeFile } from 'node:fs/promises'
import { classKey } from './bt-client.mjs'
import { classifyAccess, ACCESS } from './reservations.mjs'
import {
  VERDICT,
  normCode,
  buildEquivalence,
  buildCompletedSet,
  evaluate,
} from './prereq-engine.mjs'
import {
  COMPLETED,
  COMPLETED_BY_EQUIVALENCY,
  ALL_COMPLETED,
  PROSE_SATISFIED,
  PROFILE,
} from './profile.mjs'

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'))

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function formatMeetings(meetings) {
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

/** classes.berkeley.edu detail slug, for verifying a class against the source. */
function sourceUrl(c) {
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

async function main() {
  const raw = await read('../data/fall2026-raw.json')
  const { reservations } = await read('../data/fall2026-reservations.json')
  const cd = await read('../data/coursedog-courses.json')

  // ---- lookup tables -------------------------------------------------------
  const equiv = buildEquivalence(raw.courses)
  const allCodes = new Set(raw.courses.map((c) => normCode(`${c.subject}${c.number}`)))
  for (const c of cd.courses) allCodes.add(normCode(c.code))

  const completed = buildCompletedSet(ALL_COMPLETED, equiv, allCodes)
  // Equivalency credit counts as done for exclusion too — holding MATH 51/52
  // credit means MATH 52 shouldn't be recommended back to you.
  const completedRoots = new Set(ALL_COMPLETED.map((c) => equiv.find(normCode(c))))
  const subjects = new Set(raw.courses.map((c) => c.subject))
  const idToCode = new Map(cd.courses.map((c) => [c.id, normCode(c.code)]))
  const cdByCode = new Map(cd.courses.map((c) => [normCode(c.code), c]))
  const btByCode = new Map(raw.courses.map((c) => [normCode(`${c.subject}${c.number}`), c]))

  const nonReserved = new Set(raw.nonReservedKeys)

  // ---- per-class evaluation ------------------------------------------------
  const rows = []
  let skippedCompleted = 0

  for (const c of raw.classes) {
    const code = normCode(`${c.subject}${c.courseNumber}`)

    // Don't recommend a course already finished (under any cross-listing).
    if (completedRoots.has(equiv.find(code))) {
      skippedCompleted++
      continue
    }

    const key = classKey(c)
    const access = classifyAccess(nonReserved.has(key), reservations[key])

    const bt = btByCode.get(code)
    const prereq = evaluate({
      cdCourse: cdByCode.get(code),
      btRequirements: bt?.requirements,
      idToCode,
      completed,
      subjects,
      equiv,
      proseSatisfied: PROSE_SATISFIED,
      ownSubject: c.subject,
    })

    const meetings = formatMeetings(c.meetings)
    const instructors = [...new Set(meetings.flatMap((m) => m.instructors))]

    rows.push({
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
      earliestStart: meetings.reduce(
        (min, m) => (m.startMinutes != null && m.startMinutes < min ? m.startMinutes : min),
        Infinity,
      ),
      access: access.access,
      accessNote: access.note,
      reservationGroups: access.groups,
      prereqVerdict: prereq.verdict,
      prereqSource: prereq.source,
      prereqText: prereq.text,
      url: sourceUrl(c),
    })
  }

  for (const r of rows) if (!Number.isFinite(r.earliestStart)) r.earliestStart = null

  // ---- summary -------------------------------------------------------------
  const tally = (fn) =>
    rows.reduce((acc, r) => ((acc[fn(r)] = (acc[fn(r)] ?? 0) + 1), acc), {})

  const eligible = rows.filter(
    (r) =>
      (r.access === ACCESS.OPEN || r.access === ACCESS.RESERVED_FOR_ME) &&
      (r.prereqVerdict === VERDICT.NONE || r.prereqVerdict === VERDICT.MET),
  )

  const meta = {
    ...raw.meta,
    builtAt: new Date().toISOString(),
    profile: PROFILE,
    completed: COMPLETED,
    completedByEquivalency: COMPLETED_BY_EQUIVALENCY,
    skippedAlreadyCompleted: skippedCompleted,
    totalRows: rows.length,
    eligibleCount: eligible.length,
    byAccess: tally((r) => r.access),
    byPrereq: tally((r) => r.prereqVerdict),
    prereqSources: tally((r) => r.prereqSource),
  }

  console.log('--- Fall 2026 triage dataset ---')
  console.log('rows:', rows.length, `(dropped ${skippedCompleted} already-completed)`)
  console.log('access:', meta.byAccess)
  console.log('prereq:', meta.byPrereq)
  console.log('source:', meta.prereqSources)
  console.log('CLEARED (open/reserved-for-me AND prereqs none/met):', eligible.length)

  const dest = new URL('../data/fall2026-triage.json', import.meta.url)
  await writeFile(dest, JSON.stringify({ meta, rows }))
  console.log('wrote', dest.pathname)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
