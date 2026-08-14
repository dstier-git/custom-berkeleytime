/**
 * Classify a class's seat reservations against the student profile.
 *
 * Only matters for classes whose every open seat sits behind a reservation.
 * A reservation group only helps if it still has seats left AND it describes
 * this student, so both are checked.
 *
 * Patterns below were written against the 169 distinct requirementGroup
 * descriptions actually present in Fall 2026, not invented in advance.
 */

import { PROFILE } from './profile.mjs'

export const ACCESS = {
  OPEN: 'open', // unreserved seats available to anyone
  RESERVED_FOR_ME: 'reserved_for_me', // reserved, and I'm in the reserved group
  PERMISSION: 'permission', // only instructor-permission seats remain
  UNCERTAIN: 'uncertain', // group depends on facts not in the profile
  BLOCKED: 'blocked', // every remaining seat is held for another program
}

const seatsLeft = (r) => Math.max(0, (r.maxEnroll ?? 0) - (r.enrolledCount ?? 0))

/** Does a "terms in attendance" clause cover this student? */
function termsVerdict(desc) {
  const { termsCompleted, termsIncludingTarget } = PROFILE
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
export function groupVerdict(desc) {
  const d = desc.replace(/\s+/g, ' ').trim()

  // Cohort gates that exclude a continuing, declared, non-transfer student.
  if (/new transfer|new transfers|transfers? (?:in|admits)|admitted as transfers|all new and continuing transfer/i.test(d)) {
    return PROFILE.isTransfer ? null : false
  }
  if (/new first year|new undergraduate freshman|first year in .* major/i.test(d)) return false
  if (/graduate students|master of|masters students|\bMFA\b|Public Health: Graduate/i.test(d)) return false
  if (/visiting students/i.test(d) && /excludes visiting/i.test(d) === false) return false

  // Instructor permission is not a program restriction — surfaced separately.
  if (/enrollment permission/i.test(d)) return 'permission'

  const terms = termsVerdict(d)

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
    return /undeclared/i.test(d) && PROFILE.isDeclared ? false : null
  }
  if (/computing, data science/i.test(d)) return terms === false ? false : true

  // Named some other department, college, major, or minor.
  return false
}

/**
 * Classify one class.
 * @param {boolean} hasUnreservedSeats  true if the class appears in NON_RESERVED_OPEN
 * @param {object|null} latest          Enrollment.latest, when reservations had to be fetched
 */
export function classifyAccess(hasUnreservedSeats, latest) {
  if (hasUnreservedSeats) {
    return { access: ACCESS.OPEN, groups: [], note: 'Open seats available with no reservation' }
  }

  const rows = latest?.seatReservationCount ?? []
  const live = rows.filter((r) => r.isValid !== false && seatsLeft(r) > 0)

  if (rows.length === 0) {
    return {
      access: ACCESS.UNCERTAIN,
      groups: [],
      note: 'All open seats are reserved, but the reservation breakdown was unavailable',
    }
  }
  if (live.length === 0) {
    return {
      access: ACCESS.BLOCKED,
      groups: [],
      note: 'Every reserved bucket is already full',
    }
  }

  const graded = live.map((r) => ({
    description: r.requirementGroup.description,
    code: r.requirementGroup.code,
    seatsLeft: seatsLeft(r),
    verdict: groupVerdict(r.requirementGroup.description),
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
