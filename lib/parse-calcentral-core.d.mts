import type { StudentProfile } from './types'

export const COURSE_RE: RegExp
export const DEFAULT_TARGET: string

export interface TranscriptSemester {
  key: string
  label: string
  courses: string[]
  isTarget: boolean
}

export interface ProfileMeta {
  major: string
  degree: string
  college: string
  isDeclared: boolean
  isTransfer: boolean
}

export interface ParsedTranscript {
  semesters: TranscriptSemester[]
  targetKey: string
  completed: string[]
  currentEnrollment: string[]
  termsCompleted: number
  termsIncludingTarget: number
  suggested?: ProfileMeta
}

export function semKey(season: string, year: string | number): string
export function semSort(a: string, b: string): number
export function semLabel(key: string): string
export function parseClassSlug(slug: string): string | null
export function extractCoursesFromText(raw: string): Map<string, string[]>
export function haystackFromPdfParts(parts: {
  urls?: string[]
  text?: string
  rawLatin1?: string
}): string
export function decodeLatin1(data: ArrayBuffer | Uint8Array): string
export function transcriptFromSemesters(
  semesters: Map<string, string[]>,
  targetKey?: string,
): ParsedTranscript
export function guessMetadata(text: string): ProfileMeta
export function profileFromTranscript(
  transcript: ParsedTranscript,
  meta: ProfileMeta,
): StudentProfile
export function parseProfileJson(raw: unknown): StudentProfile
