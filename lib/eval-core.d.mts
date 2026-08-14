import type { StudentProfile, TriageRow } from './types'

/** The shipped inputs prerequisite evaluation needs, from eval-inputs.json. */
export interface EvalInputs {
  meta: { builtAt: string; source: string | null }
  subjects: string[]
  codesBySubject: Record<string, string[]>
  looseCodes: string[]
  crossListings: string[][]
  idToCode: Record<string, string>
  courses: Record<string, { rules: unknown[]; requirements: string }>
}

/** Opaque derived state — build once per eval-inputs payload, reuse per profile. */
export interface EvalContext {
  codes: string[]
  equiv: { find: (code: string) => string; has: (code: string) => boolean }
  subjects: Set<string>
  idToCode: Map<string, string>
  courses: EvalInputs['courses']
}

export function expandCodes(evalInputs: EvalInputs): string[]
export function buildEvalContext(evalInputs: EvalInputs): EvalContext
export function allCompleted(profile: StudentProfile): string[]
export function applyProfile(
  rows: TriageRow[],
  ctx: EvalContext,
  profile: StudentProfile,
): { rows: TriageRow[]; skippedAlreadyCompleted: number }

export const VERDICT: {
  NONE: 'NONE'
  MET: 'MET'
  NOT_MET: 'NOT_MET'
  REVIEW: 'REVIEW'
}
