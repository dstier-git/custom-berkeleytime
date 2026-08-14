'use client'

import { useState, useEffect } from 'react'
import type { TriageDataset } from '@/lib/types'
import type { EvalInputs } from '@/lib/eval-core.mjs'
import { useCourses } from '@/hooks/use-courses'
import { useProfile } from '@/hooks/use-profile'
import Masthead from './Masthead'
import StatTiles from './StatTiles'
import ScheduleBlocks from './ScheduleBlocks'
import Tabs from './Tabs'
import ControlsBar from './ControlsBar'
import SortHeader from './SortHeader'
import CourseLedger from './CourseLedger'
import Caveats from './Caveats'

const PAGE_SIZE = 80

export default function TriagePage() {
  const [data, setData] = useState<TriageDataset | null>(null)
  const [evalInputs, setEvalInputs] = useState<EvalInputs | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { profile } = useProfile()

  useEffect(() => {
    fetch('/data/fall2026-neutral.json')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load data: ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  // The prerequisite rules are only worth downloading once there is a profile
  // to judge against, and only once however many times the profile changes.
  useEffect(() => {
    if (!profile || evalInputs) return
    let cancelled = false
    fetch('/data/eval-inputs.json')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load prerequisite rules: ${r.status}`)
        return r.json()
      })
      .then(j => { if (!cancelled) setEvalInputs(j) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [profile, evalInputs])

  const {
    courses,
    skippedAlreadyCompleted,
    filtered,
    totalFiltered,
    conflictCount,
    filters,
    setFilter,
    toggleChip,
    resetFilters,
    sortKey,
    sortDir,
    setSort,
    tab,
    setTab,
    page,
    showMore,
    stats,
    trashCourse,
    restoreCourse,
    restoreAll,
    blocks,
    addBlock,
    removeBlock,
    toggleBlock,
    toggleAllBlocks,
  } = useCourses(data, profile, evalInputs)

  if (error) {
    return (
      <div className="wrap">
        <div className="empty">
          <p>Failed to load course data.</p>
          <p style={{ fontSize: 13 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="wrap">
        <div className="loading">Loading course data…</div>
      </div>
    )
  }

  const hasMore = filtered.length < totalFiltered
  const trashedCount = courses.length - stats.total

  return (
    <div className="wrap">
      <Masthead hasProfile={!!profile} />
      <StatTiles stats={stats} hasProfile={!!profile} />
      <ScheduleBlocks
        blocks={blocks}
        addBlock={addBlock}
        removeBlock={removeBlock}
        toggleBlock={toggleBlock}
        toggleAllBlocks={toggleAllBlocks}
      />
      <Tabs
        tab={tab}
        setTab={setTab}
        listCount={stats.total}
        trashCount={trashedCount}
      />
      <ControlsBar
        filters={filters}
        setFilter={setFilter}
        toggleChip={toggleChip}
        resetFilters={resetFilters}
        courses={courses}
      />

      <div className="resultline">
        <span>
          <b>{filtered.length}</b> of <b>{totalFiltered}</b> courses
        </span>
        {conflictCount > 0 && (
          <span className="conflict-note">
            {conflictCount} hidden by schedule conflicts
          </span>
        )}
        {tab === 'trash' && totalFiltered > 0 && (
          <button className="linkbtn" type="button" onClick={restoreAll}>
            Restore all
          </button>
        )}
      </div>

      <SortHeader sortKey={sortKey} sortDir={sortDir} setSort={setSort} />

      <CourseLedger
        courses={filtered}
        tab={tab}
        trashCourse={trashCourse}
        restoreCourse={restoreCourse}
      />

      {hasMore && (
        <button className="more" type="button" onClick={showMore}>
          Show more
        </button>
      )}

      <Caveats
        meta={data.meta}
        profile={profile}
        skippedAlreadyCompleted={skippedAlreadyCompleted}
      />
    </div>
  )
}
