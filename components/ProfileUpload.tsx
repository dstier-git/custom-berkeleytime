'use client'

import { useCallback, useRef, useState } from 'react'
import type { StudentProfile } from '@/lib/types'
import {
  parseCalCentralPdf,
  parseProfileJson,
  profileFromTranscript,
  type ParsedTranscript,
  type ProfileMeta,
} from '@/lib/parse-pdf'

const COLLEGES = ['L&S', 'CDSS', 'CoE', 'Haas', 'Chemistry', 'CNR', 'CED']
const DEGREES = ['BA', 'BS']

function statusLine(profile: StudentProfile): string {
  const n = (profile.completed?.length ?? 0) + (profile.completedByEquivalency?.length ?? 0)
  const who = [profile.major, profile.degree].filter(Boolean).join(' ')
  const college = profile.college ? `, ${profile.college}` : ''
  return `Profile: ${who}${college} (${n} course${n === 1 ? '' : 's'})`
}

function metaFromProfile(profile: StudentProfile): ProfileMeta {
  return {
    major: profile.major,
    degree: profile.degree,
    college: profile.college,
    isDeclared: profile.isDeclared,
    isTransfer: profile.isTransfer,
  }
}

export default function ProfileUpload({
  profile,
  setProfile,
  clearProfile,
  evaluating = false,
}: {
  profile: StudentProfile | null
  setProfile: (profile: StudentProfile) => void
  clearProfile: () => void
  evaluating?: boolean
}) {
  const pdfRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<ParsedTranscript | null>(null)
  const [meta, setMeta] = useState<ProfileMeta>({
    major: 'Undeclared',
    degree: 'BA',
    college: 'L&S',
    isDeclared: false,
    isTransfer: false,
  })
  const [editing, setEditing] = useState(false)

  const resetFile = (el: HTMLInputElement | null) => {
    if (el) el.value = ''
  }

  const onPdf = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const parsed = await parseCalCentralPdf(await file.arrayBuffer())
      setDraft(parsed)
      setMeta(parsed.suggested ?? {
        major: 'Undeclared',
        degree: 'BA',
        college: 'L&S',
        isDeclared: false,
        isTransfer: false,
      })
      setEditing(false)
    } catch (e) {
      setDraft(null)
      setError(e instanceof Error ? e.message : 'Could not read that PDF')
    } finally {
      setBusy(false)
      resetFile(pdfRef.current)
    }
  }, [])

  const onJson = useCallback(async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const text = await file.text()
      setProfile(parseProfileJson(text))
      setDraft(null)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that JSON')
    } finally {
      setBusy(false)
      resetFile(jsonRef.current)
    }
  }, [setProfile])

  const saveDraft = useCallback(() => {
    if (!draft) return
    setProfile(profileFromTranscript(draft, meta))
    setDraft(null)
    setEditing(false)
  }, [draft, meta, setProfile])

  const saveEdits = useCallback(() => {
    if (!profile) return
    setProfile({
      ...profile,
      major: meta.major.trim() || 'Undeclared',
      degree: meta.degree.trim() || 'BA',
      college: meta.college.trim() || 'L&S',
      isDeclared: meta.isDeclared,
      isTransfer: meta.isTransfer,
    })
    setEditing(false)
  }, [profile, meta, setProfile])

  const startEdit = useCallback(() => {
    if (!profile) return
    setMeta(metaFromProfile(profile))
    setDraft(null)
    setEditing(true)
  }, [profile])

  const cancelForm = useCallback(() => {
    setDraft(null)
    setEditing(false)
    setError(null)
  }, [])

  const onClear = useCallback(() => {
    clearProfile()
    setDraft(null)
    setEditing(false)
    setError(null)
  }, [clearProfile])

  const showForm = !!draft || editing
  const collegeOptions = COLLEGES.includes(meta.college) ? COLLEGES : [meta.college, ...COLLEGES]

  return (
    <section className="profile-card" aria-label="Student profile">
      <div className="profile-head">
        <h2>Profile</h2>
        {profile && !showForm && (
          <button className="linkbtn" type="button" onClick={onClear}>
            Clear profile
          </button>
        )}
      </div>

      <p className={`profile-status ${profile ? '' : 'none'}`} aria-live="polite">
        {busy ? 'Reading file…'
          : evaluating ? 'Checking prerequisites against your record…'
          : draft ? `Found ${draft.completed.length} completed course${draft.completed.length === 1 ? '' : 's'} across ${draft.termsCompleted} term${draft.termsCompleted === 1 ? '' : 's'}. Fill in who you are, then apply.`
          : profile ? statusLine(profile)
          : 'No profile loaded'}
      </p>

      {error && <p className="profile-error" role="alert">{error}</p>}

      {showForm && (
        <form
          className="profile-form"
          onSubmit={e => {
            e.preventDefault()
            if (draft) saveDraft()
            else saveEdits()
          }}
        >
          {draft && (
            <details className="profile-courses">
              <summary>Courses pulled from the PDF</summary>
              <ul>
                {draft.semesters.map(s => (
                  <li key={s.key}>
                    <b>{s.label}{s.isTarget ? ' (in progress, not counted as completed)' : ''}</b>
                    {' — '}{s.courses.join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="profile-form-row">
            <label>
              Major
              <input
                type="text"
                value={meta.major}
                onChange={e => setMeta(m => ({ ...m, major: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label>
              Degree
              <select
                value={meta.degree}
                onChange={e => setMeta(m => ({ ...m, degree: e.target.value }))}
              >
                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              College
              <input
                type="text"
                list="profile-colleges"
                value={meta.college}
                onChange={e => setMeta(m => ({ ...m, college: e.target.value }))}
                autoComplete="off"
              />
              <datalist id="profile-colleges">
                {collegeOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </label>
          </div>
          <div className="profile-form-row">
            <label className="profile-check">
              <input
                type="checkbox"
                checked={meta.isDeclared}
                onChange={e => setMeta(m => ({ ...m, isDeclared: e.target.checked }))}
              />
              Declared
            </label>
            <label className="profile-check">
              <input
                type="checkbox"
                checked={meta.isTransfer}
                onChange={e => setMeta(m => ({ ...m, isTransfer: e.target.checked }))}
              />
              Transfer student
            </label>
          </div>
          <div className="profile-form-actions">
            <button className="block-save" type="submit">
              {draft ? 'Use this profile' : 'Save'}
            </button>
            <button className="block-cancel" type="button" onClick={cancelForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {!showForm && (
        <div className="profile-actions">
          <input
            ref={pdfRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            aria-label="CalCentral Academic Summary PDF"
            onChange={e => onPdf(e.target.files?.[0])}
          />
          <input
            ref={jsonRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Student profile JSON"
            onChange={e => onJson(e.target.files?.[0])}
          />
          <button
            className="block-save"
            type="button"
            disabled={busy}
            onClick={() => pdfRef.current?.click()}
          >
            {profile ? 'Replace PDF' : 'Upload CalCentral PDF'}
          </button>
          <button
            className="block-cancel"
            type="button"
            disabled={busy}
            onClick={() => jsonRef.current?.click()}
          >
            {profile ? 'Replace JSON' : 'Upload JSON'}
          </button>
          {profile && (
            <button className="linkbtn" type="button" onClick={startEdit}>
              Edit major / college
            </button>
          )}
        </div>
      )}
    </section>
  )
}
