/**
 * The student this run is filtering for. Everything that depends on "who am I"
 * lives here so it can be corrected in one place.
 *
 * Copy this file to profile.mjs and fill in your own data.
 */

/** Courses completed, as they appear on your transcript. */
export const COMPLETED = [
  // Fall 2024
  'MATH 1A', 'ENGLISH R1A',
  // Spring 2025
  'MATH 1B', 'COMPSCI 61A',
]

/**
 * Credit held by equivalency (AP, community college, etc.) rather than by a
 * Berkeley enrollment. Tracked separately so rows resting on this credit stay
 * auditable.
 */
export const COMPLETED_BY_EQUIVALENCY = [
  // e.g. 'MATH 1A', 'PHYSICS 7A',
]

/** Everything that counts as done, however the credit was earned. */
export const ALL_COMPLETED = [...COMPLETED, ...COMPLETED_BY_EQUIVALENCY]

/**
 * Prose requirements that name a body of preparation rather than a course, and
 * that the completed record demonstrably satisfies. Keyed narrowly so this
 * cannot quietly wave through unrelated prose.
 */
export const PROSE_SATISFIED = [
  // Example: if you've finished a full calculus sequence
  // /\b(?:one|1|a)\s+year\s+of\s+calculus\b/i,
]

export const PROFILE = {
  major: 'Undeclared',
  degree: 'BA',
  college: 'L&S',
  career: 'UGRD',
  isDeclared: false,
  isTransfer: false,
  isVisiting: false,
  isMinorOnly: false,
  /**
   * Terms completed as of the start of the target semester.
   * Fall 2026 itself is the next one.
   */
  termsCompleted: 2,
  termsIncludingTarget: 3,
}
