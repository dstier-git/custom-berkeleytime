/**
 * Step 4 — join catalog + reservations + prerequisites into the dataset the
 * interface renders.
 *
 * Output: data/fall2026-triage.json
 */

import { readFile, writeFile } from 'node:fs/promises'
import { classKey } from './bt-client.mjs'
import { classFacts } from './class-fields.mjs'
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
    const access = classifyAccess(nonReserved.has(key), reservations[key], PROFILE)

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

    rows.push({
      ...classFacts(c, key),
      access: access.access,
      accessNote: access.note,
      reservationGroups: access.groups,
      prereqVerdict: prereq.verdict,
      prereqSource: prereq.source,
      prereqText: prereq.text,
    })
  }

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
