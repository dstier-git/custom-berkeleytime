/**
 * Step 3a — pull structured prerequisites from Coursedog, the backend behind
 * the current Berkeley catalog (undergraduate.catalog.berkeley.edu).
 *
 * Why bother when Berkeleytime already returns a `requirements` string:
 * Berkeleytime's `requiredCourses` flattens boolean structure, so
 * "MATH 53 and 54; and CS 70 or consent" collapses to an unordered list and
 * the AND/OR distinction is lost. Coursedog keeps the tree:
 *
 *   rules: [{ condition: "completedAllOf",
 *             value: { condition: "courses",
 *                      values: [{ logic: "and", value: ["1044331","1044261"] }] } }]
 *
 * Rules that Berkeley entered as prose come back as `condition: "freeformText"`
 * and still have to be read as text — those become REVIEW verdicts.
 *
 * Auth: none. The API only checks that an Origin header is present.
 *
 * Output: data/coursedog-courses.json
 */

import { writeFile, mkdir } from 'node:fs/promises'

// UC Berkeley Undergraduate Catalog 2026-2027 — the one covering Fall 2026.
const CATALOG_ID = 'hMSTjIplK6VX5nnJn7ZE'
const SCHOOL = 'ucberkeley_peoplesoft'
const PAGE = 2000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(skip) {
  const url =
    `https://app.coursedog.com/api/v1/cm/${SCHOOL}/courses/search/%24filters` +
    `?catalogId=${CATALOG_ID}&skip=${skip}&limit=${PAGE}` +
    `&orderBy=catalogDisplayName&formatDependents=false` +
    `&returnFields=code,courseGroupId,name,requisites`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      // The CORS check is the only gate; without it the API returns 401.
      Origin: 'https://undergraduate.catalog.berkeley.edu',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ condition: 'and', filters: [] }),
  })
  if (!res.ok) throw new Error(`Coursedog HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function main() {
  const all = []
  let total = null
  for (let skip = 0; total === null || skip < total; skip += PAGE) {
    const { data, listLength } = await fetchPage(skip)
    if (total === null) {
      total = listLength
      process.stderr.write(`Coursedog catalog ${CATALOG_ID}: ${total} courses\n`)
    }
    if (!data?.length) break
    all.push(...data)
    process.stderr.write(`\r  fetched ${all.length}/${total}`)
    await sleep(150)
  }
  process.stderr.write('\n')

  if (all.length !== total) {
    throw new Error(`Coursedog: expected ${total} courses, collected ${all.length}`)
  }

  // Keep only what the prereq engine needs, and drop courses with no rules.
  const slim = all.map((c) => ({
    code: c.code,
    id: String(c.courseGroupId),
    name: c.name,
    rules: (c.requisites?.requisitesSimple ?? [])
      .filter((g) => g.type === 'Prerequisite' || g.type === 'Corequisite')
      .flatMap((g) => (g.rules ?? []).map((r) => ({ group: g.type, ...r }))),
  }))

  const withRules = slim.filter((c) => c.rules.length > 0)
  const structured = withRules.filter((c) => c.rules.some((r) => r.condition !== 'freeformText'))
  process.stderr.write(
    `  ${withRules.length} with requisite rules, ${structured.length} at least partly structured\n`,
  )

  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  const dest = new URL('../data/coursedog-courses.json', import.meta.url)
  await writeFile(dest, JSON.stringify({ fetchedAt: new Date().toISOString(), catalogId: CATALOG_ID, courses: slim }))
  process.stderr.write(`Wrote ${dest.pathname}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
