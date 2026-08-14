'use client'

import { useCallback } from 'react'
import type { StudentProfile } from '@/lib/types'
import { useLocalStorage } from './use-local-storage'

const KEY = 'fall2026-triage-profile-v1'

/**
 * The uploaded student profile, or null before one arrives. Hydrates from
 * localStorage after mount, so the server and the first client render agree on
 * "no profile" and the app has to work in that state regardless.
 */
export function useProfile() {
  const [profile, setProfile] = useLocalStorage<StudentProfile | null>(KEY, null)

  const clearProfile = useCallback(() => setProfile(null), [setProfile])

  return { profile, setProfile, clearProfile }
}
