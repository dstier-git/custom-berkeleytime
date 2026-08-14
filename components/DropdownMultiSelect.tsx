'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Item {
  value: string
  label: string
  count: number
}

interface DropdownMultiSelectProps {
  label: string
  items: Item[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
  searchable?: boolean
  width?: number
}

export default function DropdownMultiSelect({
  label, items, selected, onChange, searchable = false, width,
}: DropdownMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const isAllSelected = selected.size === 0
  const activeCount = isAllSelected ? 0 : selected.has('__none__') ? 0 : selected.size

  const toggleItem = useCallback((value: string, checked: boolean) => {
    const checkedSet = new Set<string>()
    for (const item of items) {
      if (item.value === value) {
        if (checked) checkedSet.add(item.value)
      } else {
        const wasChecked = isAllSelected || selected.has(item.value)
        if (wasChecked) checkedSet.add(item.value)
      }
    }
    onChange(checkedSet.size === items.length ? new Set() : checkedSet)
  }, [items, selected, isAllSelected, onChange])

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      onChange(new Set(['__none__']))
    } else {
      onChange(new Set())
    }
  }, [isAllSelected, onChange])

  const lowerSearch = search.toLowerCase()

  return (
    <div className={`dropdown${open ? ' open' : ''}`} ref={ref}>
      <button
        className="dropdown-toggle"
        type="button"
        onClick={() => setOpen(o => !o)}
      >
        {activeCount === 0 && !selected.has('__none__') ? (
          <>All {label} <span className="arrow">&#9662;</span></>
        ) : (
          <>
            {activeCount} {label}
            <span className="dcount">{activeCount}/{items.length}</span>
            {' '}<span className="arrow">&#9662;</span>
          </>
        )}
      </button>
      <div className="dropdown-panel" style={width ? { width } : undefined}>
        <div className="dropdown-head">
          {searchable && (
            <input
              type="text"
              placeholder={`Filter ${label}…`}
              autoComplete="off"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          )}
          <button
            className="selall"
            type="button"
            onClick={toggleAll}
            style={!searchable ? { marginLeft: 'auto' } : undefined}
          >
            {isAllSelected ? 'None' : 'All'}
          </button>
        </div>
        <div className="dropdown-list">
          {items.map(item => {
            if (lowerSearch && !item.label.toLowerCase().includes(lowerSearch)) return null
            const checked = isAllSelected || selected.has(item.value)
            return (
              <label key={item.value}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={e => toggleItem(item.value, e.target.checked)}
                />
                {item.label}
                <span style={{
                  color: 'var(--faint)',
                  fontFamily: 'var(--sans)',
                  fontSize: '10px',
                  fontVariantNumeric: 'tabular-nums',
                  marginLeft: 'auto',
                }}>
                  {item.count}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
