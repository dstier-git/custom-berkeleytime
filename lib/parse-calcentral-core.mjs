/**
 * CalCentral Academic Summary extraction, shared by the Node CLI and the
 * browser parser. The regex is the original one from parse-calcentral.mjs;
 * callers are responsible for feeding it a string that still contains those
 * URI fragments (pdf.js annotation URLs need a trailing ")" appended, because
 * in the PDF the URI is wrapped in parentheses).
 */

export const COURSE_RE = /\/semester\/(fall|spring|summer)-(\d{4})\/class\/(.+)-\d{4}-[A-Z]\)/g

export const DEFAULT_TARGET = 'fall-2026'

const SEASON_ORDER = { spring: 0, summer: 1, fall: 2 }
const SEASON_LABEL = { spring: 'Spring', summer: 'Summer', fall: 'Fall' }

export function semKey(season, year) {
  return `${season}-${year}`
}

export function semSort(a, b) {
  const [sa, ya] = a.split('-')
  const [sb, yb] = b.split('-')
  return (+ya - +yb) || (SEASON_ORDER[sa] - SEASON_ORDER[sb])
}

export function semLabel(key) {
  const [season, year] = key.split('-')
  return `${SEASON_LABEL[season] ?? season} ${year}`
}

export function parseClassSlug(slug) {
  const i = slug.lastIndexOf('-')
  if (i <= 0) return null
  const subjectRaw = slug.slice(0, i)
  const number = slug.slice(i + 1).toUpperCase()
  const subject = subjectRaw.replace(/-/g, ' ').toUpperCase()
  return `${subject} ${number}`
}

/**
 * Pull course codes out of a raw string using the CalCentral class-URI regex.
 * Returns a Map of semester key → ordered unique course codes.
 */
export function extractCoursesFromText(raw) {
  const semesters = new Map()
  const seen = new Set()

  for (const m of raw.matchAll(COURSE_RE)) {
    const [, season, year, slug] = m
    const code = parseClassSlug(slug)
    if (!code) continue

    const key = semKey(season, year)
    const dedup = `${key}:${code}`
    if (seen.has(dedup)) continue
    seen.add(dedup)

    if (!semesters.has(key)) semesters.set(key, [])
    semesters.get(key).push(code)
  }

  return semesters
}

/**
 * Build the string the regex runs against from the pieces pdf.js can see.
 *
 * Annotation URLs don't include the trailing ")" that the PDF source wraps
 * around every /URI (...), so we add it back. The latin-1 dump of the file
 * bytes is the same scan `strings` does, and is the fallback if a future
 * CalCentral export stops putting the links in annotations.
 */
export function haystackFromPdfParts({ urls = [], text = '', rawLatin1 = '' } = {}) {
  const urlBlob = urls
    .filter(Boolean)
    .map((u) => (u.endsWith(')') ? u : `${u})`))
    .join('\n')
  return [urlBlob, text, rawLatin1].filter(Boolean).join('\n')
}

export function decodeLatin1(data) {
  return new TextDecoder('latin1').decode(data instanceof Uint8Array ? data : new Uint8Array(data))
}

/**
 * Split a semester map into completed vs in-progress against a target term.
 * Terms not present in the PDF are simply empty — a summary exported before
 * the student enrolled in Fall 2026 still works.
 */
export function transcriptFromSemesters(semesters, targetKey = DEFAULT_TARGET) {
  const keys = [...semesters.keys()].sort(semSort)
  const completedKeys = keys.filter((k) => k !== targetKey)
  const completed = completedKeys.flatMap((k) => semesters.get(k) ?? [])
  const currentEnrollment = semesters.get(targetKey) ?? []

  return {
    semesters: keys.map((key) => ({
      key,
      label: semLabel(key),
      courses: semesters.get(key) ?? [],
      isTarget: key === targetKey,
    })),
    targetKey,
    completed,
    currentEnrollment,
    termsCompleted: completedKeys.length,
    termsIncludingTarget: completedKeys.length + 1,
  }
}

const COLLEGE_HINTS = [
  [/comp(?:uting)?,?\s*data sci|data sci(?:ence)?\s*&\s*soc|\bCDSS\b/i, 'CDSS'],
  [/letters\s*&\s*sci|college of letters|\bL&S\b/i, 'L&S'],
  [/\b(?:college of )?engineering\b|\bCoE\b/i, 'CoE'],
  [/\bHaas\b|business administration/i, 'Haas'],
  [/natural resources|\bCNR\b/i, 'CNR'],
  [/environmental design|\bCED\b/i, 'CED'],
  [/\bchemistry\b/i, 'Chemistry'],
]

/**
 * Best-effort metadata from the Academic Summary header. Always shown in the
 * form so the student can correct it — CalCentral wording drifts.
 */
export function guessMetadata(text) {
  const header = (text || '').slice(0, 2000)
  // One or two Title-Case words immediately before BA/BS. Wider windows
  // swallow the college line ("Data Sci & Soc  Data Science BA").
  const degreeMatches = [...header.matchAll(
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(BA|BS)\b/g,
  )]
  const degreeMatch = degreeMatches[degreeMatches.length - 1]
  const major = degreeMatch ? degreeMatch[1].trim() : 'Undeclared'
  const degree = degreeMatch ? degreeMatch[2] : 'BA'
  let college = 'L&S'
  for (const [re, label] of COLLEGE_HINTS) {
    if (re.test(header)) {
      college = label
      break
    }
  }
  return {
    major,
    degree,
    college,
    isDeclared: !/^undeclared$/i.test(major),
    isTransfer: false,
  }
}

export function profileFromTranscript(transcript, meta) {
  return {
    major: meta.major.trim() || 'Undeclared',
    degree: meta.degree.trim() || 'BA',
    college: meta.college.trim() || 'L&S',
    career: 'UGRD',
    isDeclared: !!meta.isDeclared,
    isTransfer: !!meta.isTransfer,
    isVisiting: false,
    isMinorOnly: false,
    termsCompleted: transcript.termsCompleted,
    termsIncludingTarget: transcript.termsIncludingTarget,
    completed: [...transcript.completed],
    completedByEquivalency: [],
    proseSatisfied: [],
  }
}

function expectString(obj, key) {
  if (typeof obj[key] !== 'string' || !obj[key].trim()) {
    throw new Error(`Profile JSON is missing a string "${key}"`)
  }
  return obj[key].trim()
}

function expectBool(obj, key) {
  if (typeof obj[key] !== 'boolean') {
    throw new Error(`Profile JSON is missing a boolean "${key}"`)
  }
  return obj[key]
}

function expectNumber(obj, key) {
  if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key])) {
    throw new Error(`Profile JSON is missing a number "${key}"`)
  }
  return obj[key]
}

function expectStringArray(obj, key, { required } = { required: false }) {
  if (obj[key] == null) {
    if (required) throw new Error(`Profile JSON is missing an array "${key}"`)
    return []
  }
  if (!Array.isArray(obj[key]) || obj[key].some((c) => typeof c !== 'string')) {
    throw new Error(`Profile JSON "${key}" must be an array of strings`)
  }
  return obj[key].map((c) => c.trim()).filter(Boolean)
}

/** Validate a JSON value as a StudentProfile. Throws a readable error. */
export function parseProfileJson(raw) {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      throw new Error('That file is not valid JSON')
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Profile JSON must be an object')
  }

  const completed = expectStringArray(raw, 'completed', { required: true })
  const termsCompleted = expectNumber(raw, 'termsCompleted')
  const termsIncludingTarget = expectNumber(raw, 'termsIncludingTarget')

  return {
    major: expectString(raw, 'major'),
    degree: expectString(raw, 'degree'),
    college: expectString(raw, 'college'),
    career: typeof raw.career === 'string' ? raw.career : 'UGRD',
    isDeclared: expectBool(raw, 'isDeclared'),
    isTransfer: expectBool(raw, 'isTransfer'),
    isVisiting: typeof raw.isVisiting === 'boolean' ? raw.isVisiting : false,
    isMinorOnly: typeof raw.isMinorOnly === 'boolean' ? raw.isMinorOnly : false,
    termsCompleted,
    termsIncludingTarget,
    completed,
    completedByEquivalency: expectStringArray(raw, 'completedByEquivalency'),
    proseSatisfied: expectStringArray(raw, 'proseSatisfied'),
  }
}
