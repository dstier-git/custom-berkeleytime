import type { StudentProfile, TriageMeta } from '@/lib/types'

/** Limitations that hold no matter who is looking. */
const GENERAL_CAVEATS = [
  <>Prerequisites come from the catalog&rsquo;s structured rules where they exist, and from parsed prose where they don&rsquo;t. Anything the parser could not resolve is marked <code>Needs review</code> rather than guessed — the raw text is shown on every row.</>,
  'Some classes carry an enrollment restriction beyond seat reservations that this data source does not expose. Every course code links to its official class page — check there before enrolling.',
  'Seat counts are a snapshot, not a live feed. The Adjustment Period opens Aug 17, 2026, so these numbers will move.',
]

/** Limitations that only exist because a profile is being applied. */
const PROFILE_CAVEATS = [
  'Grades are not checked. Your course list has no grades, so a prerequisite demanding "C- or better" is treated as met.',
  <>Credit claimed by equivalency rather than by a Berkeley enrollment — lower-division calculus, for instance — rests on what your profile says, not on a transcript. Requirements resting on it are counted as satisfied.</>,
  <>AP, transfer, and concurrent-enrollment credit that your profile does not list is invisible here, so some <code>Prereqs unmet</code> verdicts may be wrong in your favor.</>,
  <>&ldquo;Terms in attendance&rdquo; reservations that hinge on whether Fall 2026 itself counts as your next term are reported as <code>Eligibility unclear</code>, not resolved.</>,
  'Courses you have already completed are excluded, including under their cross-listings.',
]

/** What you get instead, before a profile is loaded. */
const NEUTRAL_CAVEATS = [
  <>Nothing here is checked against a student yet. Every class with a prerequisite reads <code>Needs review</code>, and every class whose remaining seats are reserved reads <code>Eligibility unclear</code> — load your academic summary to resolve both.</>,
  <>Classes with no prerequisites at all, and classes with unreserved open seats, are the same for everybody, so those are reported as they stand.</>,
]

export default function Caveats({
  meta,
  profile,
  skippedAlreadyCompleted = 0,
}: {
  meta: TriageMeta
  profile?: StudentProfile | null
  skippedAlreadyCompleted?: number
}) {
  const items = [...(profile ? PROFILE_CAVEATS : NEUTRAL_CAVEATS), ...GENERAL_CAVEATS]

  const stamp = [
    `Fetched ${new Date(meta.fetchedAt).toLocaleString()}`,
    `${meta.openTotal} open classes in Fall 2026, ${meta.undergradOpenTotal} undergraduate`,
    profile ? `${skippedAlreadyCompleted} already-completed dropped` : null,
    profile
      ? `profile: ${[profile.major, profile.degree].filter(Boolean).join(' ')}${profile.college ? `, ${profile.college}` : ''}`
      : 'no profile loaded',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="caveats">
      <h2>What this can and can&rsquo;t tell you</h2>
      <ol>
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ol>
      <p className="stamp">{stamp}</p>
    </section>
  )
}
