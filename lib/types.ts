export interface Meeting {
  days: string | null
  time: string
  location: string | null
  startMinutes: number | null
  endMinutes: number | null
}

/**
 * A seat-reservation bucket that still has room. `verdict` is the grading
 * against the current profile — absent groups on a neutral row simply haven't
 * been graded yet.
 */
export interface ReservationGroup {
  description: string
  code: string
  seatsLeft: number
  verdict?: boolean | null | 'permission'
}

/**
 * The profile-independent reservation facts, carried on every neutral row so
 * access can be re-graded in the browser without refetching.
 */
export interface ReservationInputs {
  state: 'open' | 'unknown' | 'full' | 'live'
  groups: ReservationGroup[]
}

/** Who the student is. Must survive a round trip through JSON. */
export interface StudentProfile {
  major: string
  degree: string
  college: string
  career?: string
  isDeclared: boolean
  isTransfer: boolean
  isVisiting?: boolean
  isMinorOnly?: boolean
  /** Terms completed before the target term, and including it. */
  termsCompleted: number
  termsIncludingTarget: number
  completed: string[]
  /** Credit held by equivalency rather than by a Berkeley enrollment. */
  completedByEquivalency?: string[]
  /** Regex sources for prose requirements this record demonstrably satisfies. */
  proseSatisfied?: string[]
}

export interface TriageRow {
  key: string
  code: string
  subject: string
  courseNumber: string
  title: string
  description: string
  section: string
  level: string
  units: number | null
  unitsMin: number | null
  component: string
  gradingBasis: string
  department: string
  breadth: string[]
  universityReqs: string[]
  avgGrade: number | null
  prereqVerdict: 'NONE' | 'MET' | 'REVIEW' | 'NOT_MET'
  prereqSource: string
  prereqText: string
  access: 'open' | 'reserved_for_me' | 'permission' | 'uncertain' | 'blocked'
  accessNote: string
  online: boolean
  url: string
  instructors: string[]
  openSeats: number
  enrolled: number
  capacity: number
  waitlisted: number
  waitlistMax: number
  meetings: Meeting[]
  earliestStart: number | null
  reservationGroups?: ReservationGroup[]
  /** Present on neutral rows; the input to client-side access grading. */
  resv?: ReservationInputs
}

export interface TriageMeta {
  fetchedAt: string
  openTotal: number
  undergradOpenTotal: number
  /** Absent on the neutral dataset, which drops nothing. */
  skippedAlreadyCompleted?: number
  profile?: {
    major: string
    degree: string
    college: string
  } | null
}

export interface TriageDataset {
  meta: TriageMeta
  rows: TriageRow[]
}

export interface Course {
  code: string
  subject: string
  courseNumber: string
  title: string
  description: string
  level: string
  units: number | null
  unitsMin: number | null
  component: string
  gradingBasis: string
  department: string
  breadth: string[]
  universityReqs: string[]
  avgGrade: number | null
  prereqVerdict: 'NONE' | 'MET' | 'REVIEW' | 'NOT_MET'
  prereqSource: string
  prereqText: string
  url: string
  online: boolean
  sections: TriageRow[]
  openSeats: number
  enrolled: number
  capacity: number
  waitlisted: number
  waitlistMax: number
  instructors: string[]
  access: 'open' | 'reserved_for_me' | 'permission' | 'uncertain' | 'blocked'
  accessNote: string
  earliestStart: number | null
}

export interface ScheduleBlock {
  id: string
  name: string
  days: Set<string>
  startMin: number
  endMin: number
  enabled: boolean
}

export interface ScheduleBlockSerialized {
  id: string
  name: string
  days: string[]
  startMin: number
  endMin: number
  enabled: boolean
}

export interface FilterState {
  q: string
  subject: Set<string>
  breadth: Set<string>
  day: Set<string>
  units: Set<string>
  access: Set<string>
  prereq: Set<string>
  level: Set<string>
  misc: Set<string>
}

export interface SortDef {
  k: string
  label: string
  get: (r: Course) => string | number
  num?: boolean
  desc?: boolean
}
