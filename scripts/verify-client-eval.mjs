/**
 * Does the browser-side evaluation agree with the Node build?
 *
 * Takes the neutral dataset plus eval-inputs.json, applies the profile from
 * profile.mjs the way the app applies an uploaded one, and diffs the result
 * against data/fall2026-triage.json row by row. Any disagreement in access or
 * prerequisite verdict is a real defect: both paths are supposed to be the same
 * two engines over the same facts.
 *
 * Run after either builder changes.
 */

import { readFile } from 'node:fs/promises'
import { PROFILE, COMPLETED, COMPLETED_BY_EQUIVALENCY, PROSE_SATISFIED } from './profile.mjs'
import { buildEvalContext, applyProfile } from '../lib/eval-core.mjs'

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'))

async function main() {
  const neutral = await read('../public/data/fall2026-neutral.json')
  const evalInputs = await read('../public/data/eval-inputs.json')
  const expected = await read('../data/fall2026-triage.json')

  const profile = {
    ...PROFILE,
    completed: COMPLETED,
    completedByEquivalency: COMPLETED_BY_EQUIVALENCY,
    proseSatisfied: PROSE_SATISFIED.map((re) => re.source),
  }

  const ctx = buildEvalContext(evalInputs)
  const started = Date.now()
  const { rows, skippedAlreadyCompleted } = applyProfile(neutral.rows, ctx, profile)
  const ms = Date.now() - started

  const expectedByKey = new Map(expected.rows.map((r) => [r.key, r]))
  const actualByKey = new Map(rows.map((r) => [r.key, r]))

  const problems = []
  const counts = { access: 0, prereqVerdict: 0, prereqSource: 0, prereqText: 0, accessNote: 0 }

  for (const [key, want] of expectedByKey) {
    const got = actualByKey.get(key)
    if (!got) {
      problems.push(`${want.code} ${key}: missing from client evaluation`)
      continue
    }
    for (const field of Object.keys(counts)) {
      if (got[field] !== want[field]) {
        counts[field]++
        if (problems.length < 25) {
          problems.push(
            `${want.code} ${key} ${field}:\n    node   = ${JSON.stringify(want[field])}\n    client = ${JSON.stringify(got[field])}`,
          )
        }
      }
    }
  }

  const extra = [...actualByKey.keys()].filter((k) => !expectedByKey.has(k))

  console.log('--- client evaluation vs. Node build ---')
  console.log(`neutral rows:            ${neutral.rows.length}`)
  console.log(`client rows after eval:  ${rows.length} (dropped ${skippedAlreadyCompleted} completed)`)
  console.log(`node rows:               ${expected.rows.length} (dropped ${expected.meta.skippedAlreadyCompleted})`)
  console.log(`evaluation time:         ${ms}ms`)
  console.log('field mismatches:', counts)
  if (extra.length) console.log(`rows the client kept but node dropped: ${extra.length}`)

  if (problems.length || extra.length) {
    console.log('\n' + problems.join('\n'))
    console.log('\nFAIL')
    process.exit(1)
  }
  console.log('\nOK — every row agrees on access and prerequisites.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
