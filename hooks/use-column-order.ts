'use client'

import { useCallback, useMemo, type CSSProperties } from 'react'
import { useLocalStorage } from './use-local-storage'

export const DATA_COLUMNS = ['seats', 'course', 'avg', 'when'] as const
export type DataColumnId = (typeof DATA_COLUMNS)[number]
export type ColumnId = DataColumnId | 'action'

export const COLUMN_LABELS: Record<DataColumnId, string> = {
  seats: 'Seats',
  course: 'Course',
  avg: 'Avg',
  when: 'When',
}

export const COLUMN_WIDTHS: Record<ColumnId, string> = {
  seats: '70px',
  course: 'minmax(0, 1fr)',
  avg: '44px',
  when: '160px',
  action: '24px',
}

const COLUMN_PX: Record<ColumnId, number> = {
  seats: 70,
  course: 0,
  avg: 44,
  when: 160,
  action: 24,
}

export const DEFAULT_COLUMN_ORDER: ColumnId[] = ['seats', 'course', 'avg', 'when', 'action']

function isDataColumn(id: string): id is DataColumnId {
  return (DATA_COLUMNS as readonly string[]).includes(id)
}

export function normalizeColumnOrder(raw: unknown): ColumnId[] {
  if (!Array.isArray(raw)) return DEFAULT_COLUMN_ORDER
  const seen = new Set<DataColumnId>()
  const data: DataColumnId[] = []
  for (const id of raw) {
    if (typeof id === 'string' && isDataColumn(id) && !seen.has(id)) {
      seen.add(id)
      data.push(id)
    }
  }
  for (const id of DATA_COLUMNS) {
    if (!seen.has(id)) data.push(id)
  }
  return [...data, 'action']
}

export type ColMetrics = Record<ColumnId, { left: number; width: number }>

export function previewColumnOrder(order: ColumnId[], dragId: string, dropIndex: number): ColumnId[] {
  if (!isDataColumn(dragId)) return order
  const others = order.filter((id): id is DataColumnId => id !== 'action' && id !== dragId)
  const i = Math.max(0, Math.min(dropIndex, others.length))
  return [...others.slice(0, i), dragId, ...others.slice(i), 'action']
}

export function measureColumnGap(order: ColumnId[], metrics: ColMetrics): number {
  const a = metrics[order[0]]
  const b = metrics[order[1]]
  if (!a || !b) return 6
  return Math.max(0, b.left - (a.left + a.width))
}

export function columnPositions(order: ColumnId[], metrics: ColMetrics, gap: number): Record<ColumnId, number> {
  const start = Math.min(...order.map(id => metrics[id].left))
  const pos = {} as Record<ColumnId, number>
  let x = start
  for (const id of order) {
    pos[id] = x
    x += metrics[id].width + gap
  }
  return pos
}

export function columnDropIndex(
  centerX: number,
  order: ColumnId[],
  metrics: ColMetrics,
  dragId: DataColumnId,
  gap: number,
): number {
  const others = order.filter((id): id is DataColumnId => id !== 'action' && id !== dragId)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i <= others.length; i++) {
    const preview = previewColumnOrder(order, dragId, i)
    const pos = columnPositions(preview, metrics, gap)
    const dist = Math.abs(centerX - (pos[dragId] + metrics[dragId].width / 2))
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

export function columnShifts(
  preview: ColumnId[],
  metrics: ColMetrics,
  gap: number,
): Record<ColumnId, number> {
  const to = columnPositions(preview, metrics, gap)
  const shifts = {} as Record<ColumnId, number>
  for (const id of preview) {
    shifts[id] = to[id] - metrics[id].left
  }
  return shifts
}

export function ledgerColumnStyle(order: ColumnId[]): CSSProperties {
  const courseIdx = order.indexOf('course')
  const indent = 12 + order.slice(0, courseIdx).reduce((sum, id) => {
    const w = COLUMN_PX[id]
    return w ? sum + w + 6 : sum
  }, 0)
  return {
    '--ledger-cols': order.map(id => COLUMN_WIDTHS[id]).join(' '),
    '--col-seats': order.indexOf('seats') + 1,
    '--col-course': order.indexOf('course') + 1,
    '--col-avg': order.indexOf('avg') + 1,
    '--col-when': order.indexOf('when') + 1,
    '--col-action': order.indexOf('action') + 1,
    '--moresec-indent': `${indent}px`,
  } as CSSProperties
}

export function useColumnOrder() {
  const [raw, setRaw] = useLocalStorage<ColumnId[]>('fall2026-triage-cols-v1', DEFAULT_COLUMN_ORDER)
  const order = useMemo(() => normalizeColumnOrder(raw), [raw])

  const setOrder = useCallback((v: ColumnId[] | ((prev: ColumnId[]) => ColumnId[])) => {
    setRaw(prev => {
      const current = normalizeColumnOrder(prev)
      const next = typeof v === 'function' ? v(current) : v
      return normalizeColumnOrder(next)
    })
  }, [setRaw])

  return [order, setOrder] as const
}
