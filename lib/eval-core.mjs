/**
 * Re-running the triage verdicts in the browser.
 *
 * The neutral dataset ships with everything unjudged. Once a profile is loaded,
 * this walks every row and replaces the two verdicts that depend on who the
 * student is — prerequisites and seat access — using the same engines the Node
 * build uses. Nothing is refetched: the reservation inputs travel on each row
 * and the prerequisite rules travel in eval-inputs.json.
 *
 * Plain .mjs rather than .ts so the verification script can import it directly
 * and diff its output against the Node-built dataset.
 */

import {
  VERDICT,
  normCode,
  buildCompletedSet,
  evaluate,
} from '../scripts/prereq-engine.mjs'
import { classifyFromInputs } from '../scripts/reservations.mjs'

/**
 * Rebuild the union-find over cross-listings from the shipped groups.
 *
 * Mirrors buildEquivalence in prereq-engine.mjs, but reads a flat list of code
 * groups instead of Berkeleytime course records. Registration order differs;
 * the resulting partition does not, and only the partition is observable.
 */
function buildEquivalenceFrom(codes, crossListings) {
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

  for (const code of codes) find(code)
  for (const group of crossListings) {
    for (let i = 1; i < group.length; i++) union(group[0], group[i])
  }
  return { find, has: (x) => parent.has(x) }
}

/** Flatten codesBySubject back into the full list of catalog codes. */
export function expandCodes(evalInputs) {
  const out = []
  for (const [subject, numbers] of Object.entries(evalInputs.codesBySubject ?? {})) {
    for (const n of numbers) out.push(subject + n)
  }
  for (const c of evalInputs.looseCodes ?? []) out.push(c)
  return out
}

/**
 * Everything derived from eval-inputs.json that doesn't change when the profile
 * does. Worth building once and reusing across profile edits.
 */
export function buildEvalContext(evalInputs) {
  const codes = expandCodes(evalInputs)
  return {
    codes,
    equiv: buildEquivalenceFrom(codes, evalInputs.crossListings ?? []),
    subjects: new Set(evalInputs.subjects ?? []),
    idToCode: new Map(Object.entries(evalInputs.idToCode ?? {})),
    courses: evalInputs.courses ?? {},
  }
}

/**
 * Prose requirements a profile claims to satisfy, carried as regex source
 * strings because a profile has to survive a round trip through JSON. An
 * unparseable pattern is dropped rather than thrown — a bad entry should not
 * take the whole evaluation down.
 */
function compileProseSatisfied(profile) {
  return (profile.proseSatisfied ?? [])
    .map((src) => {
      try {
        return new RegExp(src, 'i')
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** Every code the profile counts as done, however the credit was earned. */
export function allCompleted(profile) {
  return [...(profile.completed ?? []), ...(profile.completedByEquivalency ?? [])]
}

/**
 * Re-grade neutral rows against a profile.
 *
 * Courses the student has already finished are dropped, including under any
 * cross-listing — the same exclusion the Node build applies, so the two
 * datasets stay comparable.
 *
 * @param {Array} rows        rows from fall2026-neutral.json
 * @param {object} ctx        from buildEvalContext
 * @param {object} profile    StudentProfile
 * @returns {{rows: Array, skippedAlreadyCompleted: number}}
 */
export function applyProfile(rows, ctx, profile) {
  const { equiv, subjects, idToCode, courses, codes } = ctx
  const done = allCompleted(profile)

  const completed = buildCompletedSet(done, equiv, codes)
  const completedRoots = new Set(done.map((c) => equiv.find(normCode(c))))
  const proseSatisfied = compileProseSatisfied(profile)

  const out = []
  let skipped = 0

  for (const row of rows) {
    const code = normCode(row.code)
    if (completedRoots.has(equiv.find(code))) {
      skipped++
      continue
    }

    const entry = courses[code]
    const prereq = evaluate({
      cdCourse: entry ? { rules: entry.rules } : null,
      btRequirements: entry?.requirements,
      idToCode,
      completed,
      subjects,
      equiv,
      proseSatisfied,
      ownSubject: row.subject,
    })

    const access = classifyFromInputs(row.resv, profile)

    out.push({
      ...row,
      access: access.access,
      accessNote: access.note,
      reservationGroups: access.groups,
      prereqVerdict: prereq.verdict,
      prereqSource: prereq.source,
      prereqText: prereq.text,
    })
  }

  return { rows: out, skippedAlreadyCompleted: skipped }
}

export { VERDICT }
