'use client'

import { useCallback } from 'react'

export default function Masthead({ hasProfile = false }: { hasProfile?: boolean }) {
  const cycleTheme = useCallback(() => {
    const cur = document.documentElement.getAttribute('data-theme')
    if (cur === 'dark') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else if (cur === 'light') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  return (
    <header className="masthead">
      <div>
        <p className="kicker">Personal planning tool &middot; not affiliated with UC&nbsp;Berkeley</p>
        <h1>Fall 2026 Course Triage</h1>
        <p className="sub">
          {hasProfile ? (
            <>
              Every non-full undergraduate class, checked against your completed coursework
              and against who each reserved seat is actually held for.
            </>
          ) : (
            <>
              Every non-full undergraduate class in Fall 2026. Load your academic summary
              to see which prerequisites you meet and which reserved seats are held for you —
              until then, anything that depends on who you are is left unjudged.
            </>
          )}
        </p>
      </div>
      <button className="theme-btn" type="button" onClick={cycleTheme}>
        Theme
      </button>
    </header>
  )
}
