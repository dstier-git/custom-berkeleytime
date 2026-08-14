/**
 * Classify a class's seat reservations against the student profile.
 *
 * Only matters for classes whose every open seat sits behind a reservation.
 * A reservation group only helps if it still has seats left AND it describes
 * this student, so both are checked.
 *
 * Patterns below were written against the 169 distinct requirementGroup
 * descriptions actually present in Fall 2026, not invented in advance.
 *
 * The profile is threaded through as a parameter rather than imported, so the
 * same code runs in the browser against a profile the visitor uploaded. A null
 * profile means "nothing is known about the student" and grades every group as
 * unknown.
 */

export const ACCESS = {
  OPEN: 'open', // unreserved seats available to anyone
  RESERVED_FOR_ME: 'reserved_for_me', // reserved, and I'm in the reserved group
  PERMISSION: 'permission', // only instructor-permission seats remain
  UNCERTAIN: 'uncertain', // group depends on facts not in the profile
  BLOCKED: 'blocked', // every remaining seat is held for another program
}

const seatsLeft = (r) => Math.max(0, (r.maxEnroll ?? 0) - (r.enrolledCount ?? 0))

/** Does a "terms in attendance" clause cover this student? */
function termsVerdict(desc, profile) {
  const { termsCompleted, termsIncludingTarget } = profile
  const lo = termsCompleted
  const hi = termsIncludingTarget

  let m = desc.match(/(\d+)\+?\s*(?:or more)?\s*terms? in attendance/i)
  const orMore = /(\d+)\s*(?:or more|\+)\s*terms?/i.exec(desc)
  if (orMore) {
    const n = +orMore[1]
    if (hi >= n && lo >= n) return true
    if (hi < n) return false
    return null // straddles the 4-vs-5 boundary
  }

  const range = /(\d+)\s*-\s*(\d+)\s*terms?/i.exec(desc)
  if (range) {
    const [a, b] = [+range[1], +range[2]]
    if (lo >= a && hi <= b) return true
    if (hi < a || lo > b) return false
    return null
  }

  if (/first term at berkeley|in their first term|1-2 terms/i.test(desc)) return false
  return m ? null : undefined // undefined = no terms clause at all
}

/**
 * Verdict for a single reservation group: true = I qualify, false = I don't,
 * null = can't tell from the profile.
 */
export function groupVerdict(desc, profile) {
  const d = desc.replace(/\s+/g, ' ').trim()

  // With no profile there is no cohort to test a group against, so every group
  // is unknown — except an instructor-permission gate, which says nothing about
  // the student at all.
  if (!profile) return /enrollment permission/i.test(d) ? 'permission' : null

  // Cohort gates that exclude a continuing, declared, non-transfer student.
  if (/new transfer|new transfers|transfers? (?:in|admits)|admitted as transfers|all new and continuing transfer/i.test(d)) {
    return profile.isTransfer ? null : false
  }
  if (/new first year|new undergraduate freshman|first year in .* major/i.test(d)) return false
  if (/graduate students|master of|masters students|\bMFA\b|Public Health: Graduate/i.test(d)) return false
  if (/visiting students/i.test(d) && /excludes visiting/i.test(d) === false) return false

  // Instructor permission is not a program restriction — surfaced separately.
  if (/enrollment permission/i.test(d)) return 'permission'

  const terms = termsVerdict(d, profile)

  // Open to all undergraduates.
  if (/^all undergraduate students/i.test(d) || /^undergraduate students\s*-\s*excludes visiting/i.test(d)) {
    return terms === false ? false : terms === null ? null : true
  }
  // A bare "Students with N terms in attendance" has no program restriction.
  if (/^(?:college of [^:]*)?students with .*terms? in attendance$/i.test(d)) {
    return terms === undefined ? null : terms
  }

  // Does the group name this student's program?
  const isDataScience =
    /data science (?:major|majors)/i.test(d) ||
    /data science major or minor/i.test(d) ||
    /\bL&S Computer Science and Data Science Majors\b/i.test(d) ||
    /computer science or data science ba/i.test(d)
  const isDsMinorOnly = /data science minors?$/i.test(d) && !/major/i.test(d)

  if (isDsMinorOnly) return false
  if (isDataScience) {
    if (terms === false) return false
    if (terms === null) return null
    return true
  }

  // CDSS / L&S wording is ambiguous for a Data Science BA, which moved from
  // L&S to CDSS — flag rather than assume either way.
  if (/college of letters & scien|letters & science undeclared|undeclared students/i.test(d)) {
    return /undeclared/i.test(d) && profile.isDeclared ? false : null
  }
  if (/computing, data science/i.test(d)) return terms === false ? false : true

  // Named some other department, college, major, or minor.
  return false
}

/**
 * Reduce a class's raw enrollment record to the profile-independent facts that
 * decide access: whether unreserved seats exist, and which reservation buckets
 * still have room. Small and JSON-serializable, so it can be shipped to the
 * browser and re-graded there against an uploaded profile.
 *
 * @param {boolean} hasUnreservedSeats  true if the class appears in NON_RESERVED_OPEN
 * @param {object|null} latest          Enrollment.latest, when reservations had to be fetched
 * @returns {{state: 'open'|'unknown'|'full'|'live', groups: Array}}
 */
export function reservationInputs(hasUnreservedSeats, latest) {
  if (hasUnreservedSeats) return { state: 'open', groups: [] }

  const rows = latest?.seatReservationCount ?? []
  const live = rows.filter((r) => r.isValid !== false && seatsLeft(r) > 0)

  if (rows.length === 0) return { state: 'unknown', groups: [] }
  if (live.length === 0) return { state: 'full', groups: [] }

  return {
    state: 'live',
    groups: live.map((r) => ({
      description: r.requirementGroup.description,
      code: r.requirementGroup.code,
      seatsLeft: seatsLeft(r),
    })),
  }
}

/**
 * Grade reservation inputs against a profile. A null profile leaves every group
 * unknown, which surfaces as UNCERTAIN — the honest answer before a student
 * says who they are.
 */
export function classifyFromInputs(inputs, profile) {
  if (inputs.state === 'open') {
    return { access: ACCESS.OPEN, groups: [], note: 'Open seats available with no reservation' }
  }
  if (inputs.state === 'unknown') {
    return {
      access: ACCESS.UNCERTAIN,
      groups: [],
      note: 'All open seats are reserved, but the reservation breakdown was unavailable',
    }
  }
  if (inputs.state === 'full') {
    return {
      access: ACCESS.BLOCKED,
      groups: [],
      note: 'Every reserved bucket is already full',
    }
  }

  const graded = inputs.groups.map((g) => ({
    ...g,
    verdict: groupVerdict(g.description, profile),
  }))

  if (graded.some((g) => g.verdict === true)) {
    const mine = graded.filter((g) => g.verdict === true)
    return {
      access: ACCESS.RESERVED_FOR_ME,
      groups: graded,
      note: `${mine.reduce((n, g) => n + g.seatsLeft, 0)} seat(s) reserved for you: ${mine
        .map((g) => g.description)
        .join('; ')}`,
    }
  }
  if (graded.some((g) => g.verdict === null)) {
    return {
      access: ACCESS.UNCERTAIN,
      groups: graded,
      note: `Remaining seats depend on eligibility I can't confirm: ${graded
        .filter((g) => g.verdict === null)
        .map((g) => g.description)
        .join('; ')}`,
    }
  }
  if (graded.some((g) => g.verdict === 'permission')) {
    return {
      access: ACCESS.PERMISSION,
      groups: graded,
      note: 'Only instructor-permission seats remain',
    }
  }
  return {
    access: ACCESS.BLOCKED,
    groups: graded,
    note: `All remaining seats reserved for other programs: ${graded
      .map((g) => g.description)
      .join('; ')}`,
  }
}

/** Classify one class straight from its raw enrollment record. */
export function classifyAccess(hasUnreservedSeats, latest, profile) {
  return classifyFromInputs(reservationInputs(hasUnreservedSeats, latest), profile)
}
