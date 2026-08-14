'use client'

import { useState, useCallback } from 'react'
import type { ScheduleBlock } from '@/lib/types'
import { fmtBlockTime, DAY_ABB } from '@/lib/utils'

interface ScheduleBlocksProps {
  blocks: ScheduleBlock[]
  addBlock: (block: Omit<ScheduleBlock, 'id'>) => void
  removeBlock: (id: string) => void
  toggleBlock: (id: string) => void
  toggleAllBlocks: (enabled: boolean) => void
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleBlocks({
  blocks, addBlock, removeBlock, toggleBlock, toggleAllBlocks,
}: ScheduleBlocksProps) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [days, setDays] = useState<Set<string>>(new Set())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')

  const activeCount = blocks.filter(b => b.enabled).length
  const allEnabled = blocks.length > 0 && blocks.every(b => b.enabled)

  const toggleDay = useCallback((d: string) => {
    setDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    if (days.size === 0) return
    const startMin = timeToMin(startTime)
    const endMin = timeToMin(endTime)
    if (endMin <= startMin) return
    addBlock({ name: name.trim() || 'Untitled', days, startMin, endMin, enabled: true })
    setShowForm(false)
    setName('')
    setDays(new Set())
    setStartTime('09:00')
    setEndTime('10:00')
  }, [name, days, startTime, endTime, addBlock])

  const handleCancel = useCallback(() => {
    setShowForm(false)
    setName('')
    setDays(new Set())
    setStartTime('09:00')
    setEndTime('10:00')
  }, [])

  return (
    <details className="blocks-section">
      <summary>
        Schedule blocks{' '}
        <span className="count">
          {blocks.length ? `${activeCount}/${blocks.length} active` : ''}
        </span>
      </summary>
      <div className="blocks-body">
        {blocks.length > 0 && (
          <label className="blocks-selall">
            <input
              type="checkbox"
              checked={allEnabled}
              ref={el => {
                if (el) el.indeterminate = !allEnabled && blocks.some(b => b.enabled)
              }}
              onChange={e => toggleAllBlocks(e.target.checked)}
            />
            <span>{allEnabled ? 'Deselect All' : 'Select All'}</span>
          </label>
        )}

        <div className="blocks-list">
          {blocks.map(b => (
            <div key={b.id} className="block-row" data-id={b.id}>
              <input
                type="checkbox"
                checked={b.enabled}
                onChange={() => toggleBlock(b.id)}
                aria-label={`Toggle ${b.name}`}
              />
              <div className="block-info">
                <div className="block-name">{b.name}</div>
                <div className="block-time">{fmtBlockTime(b)}</div>
              </div>
              <button
                className="block-rm"
                type="button"
                onClick={() => removeBlock(b.id)}
                aria-label={`Remove ${b.name}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        {!showForm && (
          <button
            className="add-block-btn"
            type="button"
            onClick={() => setShowForm(true)}
          >
            + Add block
          </button>
        )}

        {showForm && (
          <div className="block-form">
            <input
              type="text"
              placeholder="e.g. CS 170 lecture"
              autoComplete="off"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <div className="block-form-row">
              <label>Days</label>
              <div className="block-day-chips">
                {DAY_ABB.map(d => (
                  <button
                    key={d}
                    className="block-day-chip"
                    type="button"
                    aria-pressed={days.has(d)}
                    onClick={() => toggleDay(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="block-form-row">
              <label>From</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
              <label>To</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>
            <div className="block-form-actions">
              <button
                className="block-save"
                type="button"
                onClick={handleSave}
                disabled={days.size === 0}
              >
                Save
              </button>
              <button
                className="block-cancel"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
