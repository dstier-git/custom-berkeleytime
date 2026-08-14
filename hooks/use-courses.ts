'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { TriageDataset, Course, FilterState, ScheduleBlock, ScheduleBlockSerialized, StudentProfile } from '@/lib/types'
import { buildCourses, SORTS, unitBucket, sectionConflicts, isCleared, createDefaultFilters, LANG_SUBJECTS, haystack } from '@/lib/utils'
import { buildEvalContext, applyProfile, type EvalInputs } from '@/lib/eval-core.mjs'
import { useLocalStorage } from './use-local-storage'

const PAGE_SIZE = 80

function deserializeBlocks(raw: ScheduleBlockSerialized[]): ScheduleBlock[] {
  return raw.map(b => ({ ...b, days: new Set(b.days) }))
}

function serializeBlocks(blocks: ScheduleBlock[]): ScheduleBlockSerialized[] {
  return blocks.map(b => ({ ...b, days: [...b.days] }))
}

export function useCourses(
  data: TriageDataset | null,
  profile: StudentProfile | null = null,
  evalInputs: EvalInputs | null = null,
) {
  const [filters, setFiltersState] = useState<FilterState>(() => createDefaultFilters(false))
  const [sortKey, setSortKey] = useState('code')
  const [sortDir, setSortDir] = useState(1)
  const [tab, setTabState] = useState<'list' | 'trash'>('list')
  const [page, setPage] = useState(1)

  // The profile hydrates from localStorage a beat after mount. Sensible
  // defaults differ with and without one, so they're re-applied when it
  // arrives — but never over filters the visitor has already set by hand.
  const filtersTouched = useRef(false)
  const appliedHasProfile = useRef(false)

  useEffect(() => {
    const hasProfile = !!profile
    if (filtersTouched.current || appliedHasProfile.current === hasProfile) return
    appliedHasProfile.current = hasProfile
    setFiltersState(createDefaultFilters(hasProfile))
    setPage(1)
  }, [profile])

  const [trashArr, setTrashArr] = useLocalStorage<string[]>('fall2026-triage-trash-v1', [])
  const trash = useMemo(() => new Set(trashArr), [trashArr])

  const [blocksSerialized, setBlocksSerialized] = useLocalStorage<ScheduleBlockSerialized[]>('fall2026-triage-blocks-v1', [])
  const blocks = useMemo(() => deserializeBlocks(blocksSerialized), [blocksSerialized])

  // Rebuilding the union-find and the code universe costs more than the
  // evaluation itself, so it's kept separate from the per-profile pass.
  const evalContext = useMemo(
    () => (evalInputs ? buildEvalContext(evalInputs) : null),
    [evalInputs],
  )

  const { rows, skippedAlreadyCompleted } = useMemo(() => {
    if (!data) return { rows: [], skippedAlreadyCompleted: 0 }
    if (!profile || !evalContext) {
      return { rows: data.rows, skippedAlreadyCompleted: data.meta.skippedAlreadyCompleted ?? 0 }
    }
    return applyProfile(data.rows, evalContext, profile)
  }, [data, profile, evalContext])

  const courses = useMemo(() => buildCourses(rows), [rows])

  const conflictCountRef = useRef(0)

  const { sorted: allFiltered, conflictCount } = useMemo(() => {
    if (!courses.length) return { sorted: [], conflictCount: 0 }

    const q = filters.q.trim().toLowerCase()
    const terms = q ? q.split(/\s+/) : []
    const inTrash = tab === 'trash'
    const activeBlocks = blocks.filter(b => b.enabled)
    let conflicts = 0

    const out = courses.filter(c => {
      const allTrashed = c.sections.every(s => trash.has(s.key))
      if (allTrashed !== inTrash) return false
      if (filters.access.size && !filters.access.has(c.access)) return false
      if (filters.prereq.size && !filters.prereq.has(c.prereqVerdict)) return false
      if (filters.level.size && !filters.level.has(c.level)) return false
      if (filters.subject.size && !filters.subject.has(c.subject)) return false
      if (filters.units.size && !filters.units.has(unitBucket(c.units))) return false
      if (filters.breadth.size && !(c.breadth || []).some(b => filters.breadth.has(b))) return false
      if (filters.day.size && !c.sections.some(s => s.meetings.some(m => {
        const d = m.days || ''
        for (const fd of filters.day) { if (d.includes(fd)) return true }
        return false
      }))) return false
      if (filters.misc.has('online') && !c.online) return false
      if (filters.misc.has('nowait') && c.waitlisted > 0) return false
      if (filters.misc.has('graded') && !/letter/i.test(c.gradingBasis || '')) return false
      if (filters.misc.has('breadth') && !(c.breadth || []).length) return false
      if (filters.misc.has('lang') && !LANG_SUBJECTS.has(c.subject)) return false
      if (activeBlocks.length && c.sections.every(s => sectionConflicts(s, activeBlocks))) {
        conflicts++
        return false
      }
      if (terms.length) {
        const h = haystack(c)
        if (!terms.every(t => h.includes(t))) return false
      }
      return true
    })

    const s = SORTS.find(x => x.k === sortKey) || SORTS[0]
    out.sort((a, b) => {
      const av = s.get(a)
      const bv = s.get(b)
      const cmp = s.num
        ? (av as number) - (bv as number)
        : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return cmp * sortDir
    })

    conflictCountRef.current = conflicts
    return { sorted: out, conflictCount: conflicts }
  }, [courses, filters, sortKey, sortDir, tab, trash, blocks])

  const totalFiltered = allFiltered.length
  const filtered = useMemo(() => allFiltered.slice(0, page * PAGE_SIZE), [allFiltered, page])

  const stats = useMemo(() => {
    const live = courses.filter(c => !c.sections.every(s => trash.has(s.key)))
    return {
      total: live.length,
      cleared: live.filter(isCleared).length,
      heldForYou: live.filter(c => c.access === 'reserved_for_me').length,
      needsReview: live.filter(c => c.prereqVerdict === 'REVIEW' || c.access === 'uncertain').length,
      blocked: live.filter(c => c.access === 'blocked').length,
      unmet: live.filter(c => c.prereqVerdict === 'NOT_MET').length,
    }
  }, [courses, trash])

  const setFilter = useCallback((key: keyof FilterState, value: unknown) => {
    filtersTouched.current = true
    setFiltersState(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const toggleChip = useCallback((group: 'access' | 'prereq' | 'level' | 'misc', value: string) => {
    filtersTouched.current = true
    setFiltersState(prev => {
      const next = new Set(prev[group])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [group]: next }
    })
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    filtersTouched.current = false
    setFiltersState(createDefaultFilters(!!profile))
    setPage(1)
  }, [profile])

  const setSort = useCallback((key: string) => {
    if (key === sortKey) {
      setSortDir(d => -d)
    } else {
      setSortKey(key)
      const def = SORTS.find(s => s.k === key)
      setSortDir(def?.desc ? -1 : 1)
    }
    setPage(1)
  }, [sortKey])

  const setTab = useCallback((t: 'list' | 'trash') => {
    setTabState(t)
    setPage(1)
  }, [])

  const showMore = useCallback(() => setPage(p => p + 1), [])

  const trashCourse = useCallback((course: Course) => {
    setTrashArr(prev => {
      const s = new Set(prev)
      course.sections.forEach(sec => s.add(sec.key))
      return [...s]
    })
  }, [setTrashArr])

  const restoreCourse = useCallback((course: Course) => {
    setTrashArr(prev => {
      const s = new Set(prev)
      course.sections.forEach(sec => s.delete(sec.key))
      return [...s]
    })
  }, [setTrashArr])

  const restoreAll = useCallback(() => {
    const keysToRestore = new Set(allFiltered.flatMap(c => c.sections.map(s => s.key)))
    setTrashArr(prev => prev.filter(k => !keysToRestore.has(k)))
  }, [allFiltered, setTrashArr])

  const addBlock = useCallback((block: Omit<ScheduleBlock, 'id'>) => {
    const newBlock: ScheduleBlock = { ...block, id: String(Date.now()) }
    setBlocksSerialized(prev => [...prev, { ...newBlock, days: [...newBlock.days] }])
    setPage(1)
  }, [setBlocksSerialized])

  const removeBlock = useCallback((id: string) => {
    setBlocksSerialized(prev => prev.filter(b => b.id !== id))
    setPage(1)
  }, [setBlocksSerialized])

  const toggleBlock = useCallback((id: string) => {
    setBlocksSerialized(prev =>
      prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b)
    )
    setPage(1)
  }, [setBlocksSerialized])

  const toggleAllBlocks = useCallback((enabled: boolean) => {
    setBlocksSerialized(prev => prev.map(b => ({ ...b, enabled })))
    setPage(1)
  }, [setBlocksSerialized])

  return {
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
    trash,
    trashCourse,
    restoreCourse,
    restoreAll,
    blocks,
    addBlock,
    removeBlock,
    toggleBlock,
    toggleAllBlocks,
    stats,
  }
}
