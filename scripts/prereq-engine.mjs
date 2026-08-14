/**
 * Prerequisite evaluation.
 *
 * Two sources, in order of trust:
 *
 *   1. Coursedog structured rules — a real boolean tree over course IDs:
 *        completedAllOf / completedAnyOf  ×  clause logic and / or
 *      Used whenever available (~3.3k rules). No text parsing, no guessing.
 *
 *   2. Free-text prose — the other ~5k rules, where Berkeley typed the
 *      requirement as a sentence. Parsed conservatively: anything that isn't a
 *      resolvable course reference makes its clause *uncertain* rather than
 *      failed, so "CS 61B or consent of instructor" still resolves to MET when
 *      CS 61B is complete, but "one year of calculus" resolves to REVIEW.
 *
 * Verdicts: NONE (no prereqs) / MET / NOT_MET / REVIEW.
 */

export const VERDICT = {
  NONE: 'NONE',
  MET: 'MET',
  NOT_MET: 'NOT_MET',
  REVIEW: 'REVIEW',
}

/** "COMPSCI 61A" / "compsci61a" -> "COMPSCI61A" */
export const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Build equivalence classes so a prereq naming any cross-listing of a course
 * is satisfied by having taken it under a different subject.
 * @param {Array} btCourses Berkeleytime courses with { subject, number, crossListing }
 */
export function buildEquivalence(btCourses) {
  const parent = new Map()
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x)
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)))
      x = parent.get(x)
    }
    return x
  }
  const union = (a, b) => {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const c of btCourses) {
    const self = normCode(`${c.subject}${c.number}`)
    find(self)
    for (const x of c.crossListing ?? []) union(self, normCode(`${x.subject}${x.number}`))
  }
  return { find, has: (x) => parent.has(x) }
}

/** Expand the completed list into every code that counts as the same course. */
export function buildCompletedSet(completed, equiv, allCodes) {
  const roots = new Set(completed.map((c) => equiv.find(normCode(c))))
  const set = new Set(completed.map(normCode))
  for (const code of allCodes) {
    if (roots.has(equiv.find(code))) set.add(code)
  }
  return set
}

// ---------------------------------------------------------------- structured

function evalStructured(rule, idToCode, completed) {
  const v = rule.value
  if (!v || typeof v !== 'object' || v.condition !== 'courses') return null

  const clauses = (v.values ?? []).map((clause) => {
    const codes = (clause.value ?? []).map((id) => idToCode.get(String(id))).filter(Boolean)
    if (codes.length !== (clause.value ?? []).length) return { state: 'unknown', codes }
    const ok =
      clause.logic === 'or'
        ? codes.some((c) => completed.has(c))
        : codes.every((c) => completed.has(c))
    return { state: ok ? 'met' : 'unmet', codes }
  })

  if (clauses.length === 0) return null
  if (clauses.some((c) => c.state === 'unknown')) return { verdict: VERDICT.REVIEW, clauses }

  const met =
    rule.condition === 'completedAnyOf'
      ? clauses.some((c) => c.state === 'met')
      : clauses.every((c) => c.state === 'met')

  return { verdict: met ? VERDICT.MET : VERDICT.NOT_MET, clauses }
}

// --------------------------------------------------------------------- prose

/**
 * Prerequisite prose does not use the catalog's subject codes. It writes
 * "Econ 1", "Stats 20", "EL ENG 16A", "CompSci 61B". Map whatever is written
 * back to a real subject code by stripping case and spaces, plus a short list
 * of abbreviations that don't collapse to the code on their own.
 */
const SUBJECT_ALIASES = {
  stats: 'STAT', econ: 'ECON', cs: 'COMPSCI', compsci: 'COMPSCI',
  math: 'MATH', physics: 'PHYSICS', phys: 'PHYSICS', chem: 'CHEM',
  ib: 'INTEGBI', mcb: 'MCELLBI', ee: 'ELENG', eleng: 'ELENG',
  engin: 'ENGIN', engineering: 'ENGIN', education: 'EDUC', educ: 'EDUC',
  stat: 'STAT', data: 'DATA', info: 'INFO', ugba: 'UGBA', eecs: 'EECS',
  psych: 'PSYCH', pubhlth: 'PBHLTH', poliscl: 'POLSCI', polisci: 'POLSCI',
}

const flat = (s) => String(s).toLowerCase().replace(/[^a-z&]/g, '')

function makeSubjectResolver(subjects) {
  const table = new Map()
  for (const s of subjects) table.set(flat(s), s)
  for (const [k, v] of Object.entries(SUBJECT_ALIASES)) if (!table.has(k)) table.set(k, v)
  return (words) => table.get(flat(words)) ?? null
}

/** Phrases that describe something other than a specific course. */
const VAGUE =
  /\b(consent|permission|instructor|equivalent|standing|background|familiarity|experience|proficiency|year of|years of|semester of|semesters of|high school|placement|exam|score|AP\b|department|major|graduate|senior|junior|sophomore|freshman|interview|application|audition|portfolio|concurrent)/i

/**
 * Split prose into AND-groups, then OR-alternatives, and resolve each
 * alternative to a course code where possible.
 */
export function parseProse(text, subjects, completed, equiv, proseSatisfied = [], ownSubject = null) {
  const resolveSubject = makeSubjectResolver(subjects)
  const clean = String(text)
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim()
  if (!clean) return null

  // Corequisite sentences describe concurrent enrollment, not completed work.
  const body = clean.replace(/Corequisite:.*$/i, '').trim()
  if (!body) return { verdict: VERDICT.REVIEW, groups: [] }

  const andGroups = body
    .split(/;| and (?!\/)/i)
    .map((s) => s.trim())
    .filter(Boolean)

  const groups = andGroups.map((g) => {
    const alts = g
      .split(/,| or /i)
      .map((s) => s.trim())
      .filter(Boolean)

    // A requirement written on a course's own page may omit the subject
    // entirely — MATH 104's prereq reads "53 and 54".
    let lastSubject = ownSubject
    const parsed = alts.map((alt) => {
      // "DATA/COMPSCI/INFO/STAT C8" — any listed subject works.
      const slashed = alt.match(/\b((?:[A-Za-z][A-Za-z&]+\/)+[A-Za-z][A-Za-z&]+)\s*([A-Z]?\d+[A-Z]*)\b/)
      if (slashed) {
        const parts = slashed[1].split('/').map(resolveSubject).filter(Boolean)
        const codes = parts.map((s) => normCode(s + slashed[2])).filter((c) => equiv.has(c))
        if (codes.length) {
          lastSubject = parts[parts.length - 1]
          return { kind: 'course', codes, met: codes.some((c) => completed.has(c)) }
        }
      }

      // Try each "<words> <number>" pair, preferring a two-word subject
      // ("EL ENG 16A") before falling back to one ("Econ 1").
      // Each subject word needs 2+ letters, otherwise the pattern greedily
      // eats the leading letter of a course number and "COMPSCI C100" parses
      // as subject "COMPSCI C" + number "100".
      const re = /\b([A-Za-z][A-Za-z&]+(?:\s+[A-Za-z][A-Za-z&]+)?)\s*([A-Z]?\d+[A-Z]{0,3})\b/g
      let m
      while ((m = re.exec(alt)) !== null) {
        const words = m[1].trim().split(/\s+/)
        for (let take = Math.min(2, words.length); take >= 1; take--) {
          const subj = resolveSubject(words.slice(-take).join(''))
          if (!subj) continue
          const code = normCode(subj + m[2])
          if (!equiv.has(code) && !completed.has(code)) continue
          lastSubject = subj
          return { kind: 'course', codes: [code], met: completed.has(code) }
        }
      }

      // A bare number continues the running subject: "MATH 53, 54".
      const bare = alt.match(/^([A-Z]?\d+[A-Z]{0,3})\b/)
      if (bare && lastSubject) {
        const code = normCode(lastSubject + bare[1])
        if (equiv.has(code)) return { kind: 'course', codes: [code], met: completed.has(code) }
      }

      // Prose that names preparation the student demonstrably holds.
      if (proseSatisfied.some((re) => re.test(alt))) {
        return { kind: 'course', codes: [], met: true, viaEquivalency: alt }
      }

      return { kind: VAGUE.test(alt) ? 'vague' : 'unparsed', text: alt }
    })

    const courses = parsed.filter((p) => p.kind === 'course')
    if (courses.length === 0) return { state: 'unknown', alts: parsed, text: g }
    if (courses.some((p) => p.met)) return { state: 'met', alts: parsed, text: g }
    // No alternative satisfied, but a non-course escape hatch exists.
    if (parsed.some((p) => p.kind !== 'course')) return { state: 'unknown', alts: parsed, text: g }
    return { state: 'unmet', alts: parsed, text: g }
  })

  if (groups.some((g) => g.state === 'unmet')) return { verdict: VERDICT.NOT_MET, groups }
  if (groups.some((g) => g.state === 'unknown')) return { verdict: VERDICT.REVIEW, groups }
  return { verdict: VERDICT.MET, groups }
}

// ------------------------------------------------------------------ combined

/**
 * @returns {{verdict, source, text, detail}}
 */
export function evaluate({
  cdCourse,
  btRequirements,
  idToCode,
  completed,
  subjects,
  equiv,
  proseSatisfied = [],
  ownSubject = null,
}) {
  const rules = cdCourse?.rules ?? []
  const prereqRules = rules.filter((r) => r.group === 'Prerequisite')
  const text = btRequirements?.trim() || prereqRules.find((r) => typeof r.value === 'string')?.value || ''

  if (prereqRules.length === 0 && !text) {
    return { verdict: VERDICT.NONE, source: 'none', text: '', detail: null }
  }

  const structured = prereqRules
    .filter((r) => r.condition === 'completedAllOf' || r.condition === 'completedAnyOf')
    .map((r) => evalStructured(r, idToCode, completed))
    .filter(Boolean)

  if (structured.length) {
    // Multiple requisite rules on one course are ANDed together.
    if (structured.some((s) => s.verdict === VERDICT.NOT_MET)) {
      return { verdict: VERDICT.NOT_MET, source: 'coursedog', text, detail: structured }
    }
    if (structured.some((s) => s.verdict === VERDICT.REVIEW)) {
      return { verdict: VERDICT.REVIEW, source: 'coursedog', text, detail: structured }
    }
    return { verdict: VERDICT.MET, source: 'coursedog', text, detail: structured }
  }

  if (text) {
    const prose = parseProse(text, subjects, completed, equiv, proseSatisfied, ownSubject)
    if (prose) return { verdict: prose.verdict, source: 'prose', text, detail: prose.groups }
  }

  return { verdict: VERDICT.REVIEW, source: 'unknown', text, detail: null }
}
