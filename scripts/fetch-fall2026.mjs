/**
 * Step 1 — pull everything Fall 2026 out of Berkeleytime and cache it to disk.
 *
 * Three fetches:
 *   1. every OPEN class (not full)
 *   2. every NON_RESERVED_OPEN class — the subset whose open seats are not
 *      locked behind a seat reservation. OPEN minus this set is exactly the
 *      list of classes that need per-class reservation detail in step 2.
 *   3. the whole course table in one request, for prerequisite prose.
 *
 * Output: data/fall2026-raw.json
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { gql, classKey } from './bt-client.mjs'

const YEAR = 2026
const SEMESTER = 'Fall'
const PAGE_SIZE = 100 // server caps here regardless of what we ask for

const CLASS_FIELDS = `
  year semester termId sessionId
  subject courseNumber number courseId
  title courseTitle courseDescription
  level academicCareer academicOrganizationName departmentNicknames
  unitsMin unitsMax gradingBasis finalExam
  primaryComponent primaryOnline primarySectionId
  enrollmentStatus enrolledCount maxEnroll openSeats
  waitlistedCount maxWaitlist activeReservedMaxCount
  breadthRequirements universityRequirements
  allTimeAverageGrade
  meetings { days startTime endTime location instructors { familyName givenName } }
`

async function fetchAllClasses(enrollmentFilter) {
  const query = `
    query Catalog($year: Int!, $semester: Semester!, $filters: CatalogFilters, $page: Int, $pageSize: Int) {
      catalogSearch(year: $year, semester: $semester, filters: $filters, page: $page, pageSize: $pageSize) {
        totalCount
        results { ${CLASS_FIELDS} }
      }
    }`

  const out = []
  const seen = new Set()
  let total = null
  let rawCount = 0
  // `page` is 1-indexed: page 0 and page 1 return byte-identical results, so
  // starting at 0 silently duplicates the first 100 rows.
  for (let page = 1; ; page++) {
    const data = await gql(query, {
      year: YEAR,
      semester: SEMESTER,
      filters: { enrollmentFilter },
      page,
      pageSize: PAGE_SIZE,
    })
    const { totalCount, results } = data.catalogSearch
    if (total === null) {
      total = totalCount
      process.stderr.write(`  ${enrollmentFilter}: ${total} classes\n`)
    }
    rawCount += results.length
    for (const r of results) {
      const k = classKey(r)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(r)
    }
    process.stderr.write(`\r  fetched ${rawCount}/${total}`)
    if (results.length === 0 || rawCount >= total) break
  }
  process.stderr.write('\n')

  // Assert against the raw row count, not the deduped one: the upstream index
  // contains a handful of byte-identical duplicate records (same courseId and
  // sectionId), so unique < totalCount is expected and benign.
  if (rawCount !== total) {
    throw new Error(`${enrollmentFilter}: expected ${total} rows, collected ${rawCount}`)
  }
  if (rawCount !== out.length) {
    process.stderr.write(`  (dropped ${rawCount - out.length} duplicate records)\n`)
  }
  return { total, classes: out }
}

async function fetchCourses() {
  const data = await gql(`{
    courses {
      subject
      number
      title
      requirements
      academicCareer
      crossListing { subject number }
      requiredCourses { subject number }
    }
  }`)
  return data.courses
}

async function main() {
  process.stderr.write(`Fall ${YEAR} — fetching open classes\n`)
  const open = await fetchAllClasses('OPEN')

  process.stderr.write(`Fall ${YEAR} — fetching non-reserved open classes\n`)
  const nonReserved = await fetchAllClasses('NON_RESERVED_OPEN')

  process.stderr.write('Fetching course table (prerequisites)\n')
  const courses = await fetchCourses()
  process.stderr.write(`  ${courses.length} courses, ${courses.filter((c) => c.requirements?.trim()).length} with prereq text\n`)

  // Undergraduate only. `level` is the human label; academicCareer is the
  // authoritative career code, so require both to agree before keeping a class.
  const undergrad = open.classes.filter(
    (c) => c.academicCareer === 'UGRD' && c.level !== 'Graduate',
  )
  process.stderr.write(`  ${undergrad.length}/${open.classes.length} open classes are undergraduate\n`)

  const nonReservedKeys = [...new Set(nonReserved.classes.map(classKey))]

  const payload = {
    meta: {
      fetchedAt: new Date().toISOString(),
      year: YEAR,
      semester: SEMESTER,
      openTotal: open.total,
      nonReservedOpenTotal: nonReserved.total,
      undergradOpenTotal: undergrad.length,
      courseCount: courses.length,
    },
    classes: undergrad,
    nonReservedKeys,
    courses,
  }

  await mkdir(new URL('../data/', import.meta.url), { recursive: true })
  const out = new URL('../data/fall2026-raw.json', import.meta.url)
  await writeFile(out, JSON.stringify(payload))
  process.stderr.write(`\nWrote ${out.pathname}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
