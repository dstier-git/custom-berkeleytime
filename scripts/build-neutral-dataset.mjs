/**
 * The profile-free dataset the site loads before a visitor uploads anything.
 *
 * Same join as build-dataset.mjs, minus every judgement that needs to know who
 * the student is:
 *
 *   - no course is dropped for having been completed
 *   - a class with prerequisites is REVIEW; only "has no prerequisites at all"
 *     survives as NONE, since that fact is the same for everybody
 *   - access is graded against a null profile, so anything resting on a
 *     reservation group becomes UNCERTAIN, while "unreserved seats exist" and
 *     "every bucket is full" stay as they are
 *
 * Each row also carries the raw reservation inputs, so the browser can re-grade
 * access once a profile arrives without refetching anything.
 *
 * Output: public/data/fall2026-neutral.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { classKey } from './bt-client.mjs'
import { classFacts } from './class-fields.mjs'
import { reservationInputs, classifyFromInputs } from './reservations.mjs'
import { VERDICT, normCode } from './prereq-engine.mjs'

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'))

async function main() {
  const raw = await read('../data/fall2026-raw.json')
  const { reservations } = await read('../data/fall2026-reservations.json')
  const cd = await read('../data/coursedog-courses.json')

  const cdByCode = new Map(cd.courses.map((c) => [normCode(c.code), c]))
  const btByCode = new Map(raw.courses.map((c) => [normCode(`${c.subject}${c.number}`), c]))
  const nonReserved = new Set(raw.nonReservedKeys)

  const rows = []

  for (const c of raw.classes) {
    const code = normCode(`${c.subject}${c.courseNumber}`)
    const key = classKey(c)

    const resv = reservationInputs(nonReserved.has(key), reservations[key])
    const access = classifyFromInputs(resv, null)

    // Whether a class has prerequisites at all is profile-independent; whether
    // they are met is not.
    const prereqRules = (cdByCode.get(code)?.rules ?? []).filter((r) => r.group === 'Prerequisite')
    const text =
      btByCode.get(code)?.requirements?.trim() ||
      prereqRules.find((r) => typeof r.value === 'string')?.value ||
      ''
    const hasPrereq = prereqRules.length > 0 || !!text

    rows.push({
      ...classFacts(c, key),
      access: access.access,
      accessNote: access.note,
      reservationGroups: access.groups,
      resv,
      prereqVerdict: hasPrereq ? VERDICT.REVIEW : VERDICT.NONE,
      prereqSource: hasPrereq ? 'unevaluated' : 'none',
      prereqText: text,
    })
  }

  const tally = (fn) => rows.reduce((acc, r) => ((acc[fn(r)] = (acc[fn(r)] ?? 0) + 1), acc), {})

  const meta = {
    ...raw.meta,
    builtAt: new Date().toISOString(),
    profile: null,
    totalRows: rows.length,
    byAccess: tally((r) => r.access),
    byPrereq: tally((r) => r.prereqVerdict),
  }

  console.log('--- Fall 2026 neutral dataset ---')
  console.log('rows:', rows.length)
  console.log('access:', meta.byAccess)
  console.log('prereq:', meta.byPrereq)

  const dir = new URL('../public/data/', import.meta.url)
  await mkdir(dir, { recursive: true })
  const dest = new URL('fall2026-neutral.json', dir)
  await writeFile(dest, JSON.stringify({ meta, rows }))
  console.log('wrote', dest.pathname)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
