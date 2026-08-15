'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Course } from '@/lib/types'
import CourseCard from './CourseCard'
import {
  COLUMN_LABELS,
  DATA_COLUMNS,
  columnDropIndex,
  columnShifts,
  ledgerColumnStyle,
  measureColumnGap,
  previewColumnOrder,
  useColumnOrder,
  type ColMetrics,
  type ColumnId,
  type DataColumnId,
} from '@/hooks/use-column-order'

const SETTLE_MS = 450
const LIFT_Y = -8
const ALL_COLUMNS: ColumnId[] = ['seats', 'course', 'avg', 'when', 'action']

interface CourseLedgerProps {
  courses: Course[]
  tab: 'list' | 'trash'
  trashCourse: (course: Course) => void
  restoreCourse: (course: Course) => void
}

interface DragSession {
  dragId: DataColumnId
  origin: ColumnId[]
  metrics: ColMetrics
  gap: number
  grabOffset: number
  dropIndex: number
  liftTx: number
  liftTy: number
  shifts: Record<ColumnId, number>
  settling: boolean
}

function isCompact() {
  return window.matchMedia('(max-width: 640px)').matches
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function measureColumns(head: HTMLElement, ledger: HTMLElement): ColMetrics | null {
  const ledgerLeft = ledger.getBoundingClientRect().left
  const metrics = {} as ColMetrics
  for (const el of head.querySelectorAll<HTMLElement>('[data-col]')) {
    const id = el.dataset.col as DataColumnId
    const r = el.getBoundingClientRect()
    metrics[id] = { left: r.left - ledgerLeft, width: r.width }
  }
  const action = head.querySelector<HTMLElement>('.h-action')
  if (action) {
    const r = action.getBoundingClientRect()
    metrics.action = { left: r.left - ledgerLeft, width: r.width }
  }
  if (!DATA_COLUMNS.every(id => metrics[id]) || !metrics.action) return null
  return metrics
}

function applySessionVars(el: HTMLElement, s: DragSession) {
  el.style.setProperty('--lift-tx', `${s.liftTx}px`)
  el.style.setProperty('--lift-ty', `${s.liftTy}px`)
  for (const id of ALL_COLUMNS) {
    el.style.setProperty(`--shift-${id}`, `${s.shifts[id] ?? 0}px`)
  }
}

function ColGrip() {
  return (
    <svg className="col-grip" width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">
      <circle cx="2" cy="2" r="1.15" />
      <circle cx="6" cy="2" r="1.15" />
      <circle cx="2" cy="6" r="1.15" />
      <circle cx="6" cy="6" r="1.15" />
      <circle cx="2" cy="10" r="1.15" />
      <circle cx="6" cy="10" r="1.15" />
    </svg>
  )
}

function clearSessionVars(el: HTMLElement) {
  el.style.removeProperty('--lift-tx')
  el.style.removeProperty('--lift-ty')
  for (const id of ALL_COLUMNS) el.style.removeProperty(`--shift-${id}`)
}

export default function CourseLedger({ courses, tab, trashCourse, restoreCourse }: CourseLedgerProps) {
  const [order, setOrder] = useColumnOrder()
  const [dragging, setDragging] = useState<DataColumnId | null>(null)
  const [settling, setSettling] = useState(false)
  const [liftBox, setLiftBox] = useState<{ left: number; width: number } | null>(null)
  const ledgerRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<DragSession | null>(null)
  const detachRef = useRef<(() => void) | null>(null)
  const orderRef = useRef(order)
  orderRef.current = order

  const paint = useCallback(() => {
    const el = ledgerRef.current
    const s = sessionRef.current
    if (el && s) applySessionVars(el, s)
  }, [])

  useLayoutEffect(() => {
    if (dragging) paint()
    else if (ledgerRef.current) clearSessionVars(ledgerRef.current)
  }, [dragging, settling, order, paint])

  useEffect(() => () => detachRef.current?.(), [])

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>, id: DataColumnId) => {
    if (e.button !== 0 || isCompact() || sessionRef.current) return
    const ledger = ledgerRef.current
    const head = headRef.current
    if (!ledger || !head) return
    e.preventDefault()

    const metrics = measureColumns(head, ledger)
    if (!metrics) return

    const origin = orderRef.current
    const dataOrder = origin.filter((col): col is DataColumnId => col !== 'action')
    const session: DragSession = {
      dragId: id,
      origin,
      metrics,
      gap: measureColumnGap(origin, metrics),
      grabOffset: e.clientX - (metrics[id].left + ledger.getBoundingClientRect().left),
      dropIndex: dataOrder.indexOf(id),
      liftTx: 0,
      liftTy: prefersReducedMotion() ? 0 : LIFT_Y,
      shifts: {} as Record<ColumnId, number>,
      settling: false,
    }
    for (const col of ALL_COLUMNS) session.shifts[col] = 0
    sessionRef.current = session
    setLiftBox({ left: metrics[id].left, width: metrics[id].width })
    setSettling(false)
    setDragging(id)

    const finish = (cancelled: boolean) => {
      const s = sessionRef.current
      if (!s || s.settling) return
      s.settling = true
      detachRef.current?.()
      detachRef.current = null
      setSettling(true)

      const preview = cancelled
        ? s.origin
        : previewColumnOrder(s.origin, s.dragId, s.dropIndex)

      const settle = () => {
        if (sessionRef.current !== s) return
        if (cancelled) {
          for (const col of ALL_COLUMNS) s.shifts[col] = 0
          s.liftTx = 0
        } else {
          s.shifts = columnShifts(preview, s.metrics, s.gap)
          s.liftTx = s.shifts[s.dragId] ?? 0
        }
        s.liftTy = 0
        paint()

        const commit = () => {
          if (sessionRef.current !== s) return
          if (!cancelled) setOrder(preview)
          sessionRef.current = null
          setLiftBox(null)
          setDragging(null)
          setSettling(false)
        }

        if (prefersReducedMotion()) commit()
        else window.setTimeout(commit, SETTLE_MS)
      }

      requestAnimationFrame(() => requestAnimationFrame(settle))
    }

    const onMove = (ev: PointerEvent) => {
      const s = sessionRef.current
      if (!s || s.settling) return
      const ledgerLeft = ledger.getBoundingClientRect().left
      s.liftTx = ev.clientX - s.grabOffset - ledgerLeft - s.metrics[s.dragId].left
      s.liftTy = LIFT_Y

      const centerX = ev.clientX - s.grabOffset - ledgerLeft + s.metrics[s.dragId].width / 2
      const drop = columnDropIndex(centerX, s.origin, s.metrics, s.dragId, s.gap)
      if (drop !== s.dropIndex) {
        s.dropIndex = drop
        s.shifts = columnShifts(
          previewColumnOrder(s.origin, s.dragId, drop),
          s.metrics,
          s.gap,
        )
      }
      paint()
    }

    const onUp = () => finish(false)
    const onCancel = () => finish(true)
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(true)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    detachRef.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
    }
  }

  if (courses.length === 0) {
    return (
      <div className="empty">
        <p>{tab === 'trash' ? 'Nothing in the trash.' : 'No courses match these filters.'}</p>
        <p style={{ fontSize: 13 }}>
          {tab === 'trash'
            ? 'Dismissed courses land here and can be restored.'
            : 'Try widening the Seats or Prereqs filters.'}
        </p>
      </div>
    )
  }

  return (
    <div
      ref={ledgerRef}
      className="ledger"
      data-dragging={dragging ?? undefined}
      data-settling={settling ? '' : undefined}
      style={ledgerColumnStyle(order)}
    >
      {dragging && liftBox && (
        <div
          className="col-lift"
          aria-hidden
          style={{ left: liftBox.left, width: liftBox.width }}
        />
      )}
      <div ref={headRef} className="ledger-head">
        {DATA_COLUMNS.map(id => (
          <span
            key={id}
            className={`h-${id}`}
            data-col={id}
            aria-grabbed={dragging === id}
            onPointerDown={e => onPointerDown(e, id)}
            title="Drag to reorder columns"
          >
            <ColGrip />
            {COLUMN_LABELS[id]}
          </span>
        ))}
        <span className="h-action" />
      </div>
      {courses.map(c => (
        <CourseCard
          key={c.code}
          course={c}
          tab={tab}
          onAction={tab === 'trash' ? restoreCourse : trashCourse}
        />
      ))}
    </div>
  )
}
