/**
 * Step 2a — pull per-class seat-reservation detail.
 *
 * Only classes that are OPEN but absent from NON_RESERVED_OPEN need this:
 * every one of their open seats sits behind a reservation, so whether the
 * class is actually reachable depends on *whose* reservation it is.
 *
 * Batched with GraphQL aliases, ~20 classes per POST.
 *
 * Output: data/fall2026-reservations.json
 */

import { readFile, writeFile } from 'node:fs/promises'
import { gql, classKey } from './bt-client.mjs'

// Two server-side caps bound the batch: a 1000-GraphQL-token query limit (so
// the repeated selection set lives in a fragment and each alias is one short
// line) and a hard limit of 15 aliases per query.
const BATCH = 15

const FRAGMENT = `fragment E on Enrollment {
  latest {
    startTime status enrolledCount reservedCount waitlistedCount
    maxEnroll maxWaitlist openReserved activeReservedMaxCount
    seatReservationCount {
      maxEnroll enrolledCount isValid
      requirementGroup { code description }
    }
  }
}`

const s = (v) => JSON.stringify(String(v))

async function fetchBatch(batch) {
  const body = batch
    .map(
      (c, i) =>
        `r${i}: enrollment(year:${c.year},semester:${c.semester},sessionId:${s(c.sessionId)},` +
        `subject:${s(c.subject)},courseNumber:${s(c.courseNumber)},sectionNumber:${s(c.number)}){...E}`,
    )
    .join('\n')

  const data = await gql(`{\n${body}\n}\n${FRAGMENT}`)
  return batch.map((c, i) => [classKey(c), data[`r${i}`]?.latest ?? null])
}

async function main() {
  const raw = JSON.parse(await readFile(new URL('../data/fall2026-raw.json', import.meta.url), 'utf8'))
  const nonReserved = new Set(raw.nonReservedKeys)
  const need = raw.classes.filter((c) => !nonReserved.has(classKey(c)))

  process.stderr.write(`Resolving reservations for ${need.length} classes\n`)

  const out = {}
  let missing = 0
  for (let i = 0; i < need.length; i += BATCH) {
    const batch = need.slice(i, i + BATCH)
    for (const [key, latest] of await fetchBatch(batch)) {
      if (latest === null) missing++
      out[key] = latest
    }
    process.stderr.write(`\r  ${Math.min(i + BATCH, need.length)}/${need.length}`)
  }
  process.stderr.write('\n')
  if (missing) process.stderr.write(`  ${missing} classes returned no enrollment record\n`)

  const dest = new URL('../data/fall2026-reservations.json', import.meta.url)
  await writeFile(dest, JSON.stringify({ fetchedAt: new Date().toISOString(), reservations: out }))
  process.stderr.write(`Wrote ${dest.pathname}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
