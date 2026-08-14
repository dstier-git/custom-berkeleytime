/**
 * The slim payload the browser needs to re-run prerequisite evaluation against
 * an uploaded profile — everything build-dataset.mjs feeds prereq-engine, minus
 * the 8MB of catalog text nobody reads.
 *
 * Shipped:
 *   codesBySubject  every course code in the catalog, grouped by subject to cut
 *                   the repetition. prereq-engine treats "is this a real code"
 *                   as a membership test over exactly this set, so narrowing it
 *                   would silently turn resolvable prose into REVIEW.
 *   crossListings   the cross-listing groups, so a prereq naming any listing of
 *                   a course is satisfied by having taken another.
 *   subjects        every subject, for resolving "Econ 1" back to ECON.
 *   idToCode        only the course IDs that shipped rules actually reference.
 *   courses         per course appearing in Fall 2026: its structured
 *                   Prerequisite rules and its requirement prose.
 *
 * Output: public/data/eval-inputs.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { normCode } from './prereq-engine.mjs'

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'))

/** Split "COMPSCI61A" back into subject + number given the known subject. */
const splitCode = (code, subject) => code.slice(subject.length)

async function main() {
  const raw = await read('../data/fall2026-raw.json')
  const cd = await read('../data/coursedog-courses.json')

  const subjects = [...new Set(raw.courses.map((c) => c.subject))].sort()

  // ---- the code universe ---------------------------------------------------
  // build-dataset.mjs registers every Berkeleytime course and every Coursedog
  // course before any prose is parsed, so both sets have to be here.
  const bySubject = new Map()
  const addCode = (subject, code) => {
    if (!subject || !code.startsWith(subject)) return false
    if (!bySubject.has(subject)) bySubject.set(subject, new Set())
    bySubject.get(subject).add(splitCode(code, subject))
    return true
  }

  const subjectByLength = [...subjects].sort((a, b) => b.length - a.length)
  const loose = new Set() // codes whose subject isn't in the subject list
  const register = (code) => {
    const subject = subjectByLength.find((s) => code.startsWith(s))
    if (!subject || !addCode(subject, code)) loose.add(code)
  }

  for (const c of raw.courses) register(normCode(`${c.subject}${c.number}`))
  for (const c of cd.courses) register(normCode(c.code))

  // ---- cross-listings ------------------------------------------------------
  const crossListings = []
  for (const c of raw.courses) {
    const listings = c.crossListing ?? []
    if (!listings.length) continue
    const group = [normCode(`${c.subject}${c.number}`)]
    for (const x of listings) group.push(normCode(`${x.subject}${x.number}`))
    crossListings.push(group)
  }

  // ---- per-course prerequisite inputs, only for Fall 2026 classes -----------
  const needed = new Set(raw.classes.map((c) => normCode(`${c.subject}${c.courseNumber}`)))
  const cdByCode = new Map(cd.courses.map((c) => [normCode(c.code), c]))
  const btByCode = new Map(raw.courses.map((c) => [normCode(`${c.subject}${c.number}`), c]))
  const idToCodeAll = new Map(cd.courses.map((c) => [String(c.id), normCode(c.code)]))

  const courses = {}
  const idToCode = {}

  for (const code of needed) {
    const rules = (cdByCode.get(code)?.rules ?? []).filter((r) => r.group === 'Prerequisite')
    const requirements = btByCode.get(code)?.requirements?.trim() || ''
    if (!rules.length && !requirements) continue

    for (const rule of rules) {
      const v = rule.value
      if (!v || typeof v !== 'object' || v.condition !== 'courses') continue
      for (const clause of v.values ?? []) {
        for (const id of clause.value ?? []) {
          const mapped = idToCodeAll.get(String(id))
          if (mapped) idToCode[String(id)] = mapped
        }
      }
    }

    courses[code] = { rules, requirements }
  }

  const codesBySubject = Object.fromEntries(
    [...bySubject.entries()].sort().map(([s, nums]) => [s, [...nums].sort()]),
  )

  const payload = {
    meta: { builtAt: new Date().toISOString(), source: raw.meta?.fetchedAt ?? null },
    subjects,
    codesBySubject,
    looseCodes: [...loose].sort(),
    crossListings,
    idToCode,
    courses,
  }

  const dir = new URL('../public/data/', import.meta.url)
  await mkdir(dir, { recursive: true })
  const dest = new URL('eval-inputs.json', dir)
  const json = JSON.stringify(payload)
  await writeFile(dest, json)

  console.log('--- eval inputs ---')
  console.log('subjects:', subjects.length)
  console.log('codes:', [...bySubject.values()].reduce((n, s) => n + s.size, 0), `(+${loose.size} loose)`)
  console.log('cross-listing groups:', crossListings.length)
  console.log('courses with prereqs:', Object.keys(courses).length)
  console.log('referenced course ids:', Object.keys(idToCode).length)
  console.log('wrote', dest.pathname, `${(json.length / 1024).toFixed(0)}KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
