import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from './supabase'
import { AppError, getErrorMessage, toAppError } from './errors'
import { fetchProfile, type User } from '../services/auth'

export type AuthStatus = 'initializing' | 'signing_in' | 'loading_profile' | 'ready' | 'error'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  error: string | null
  /** Re-reads the profile (e.g. after kb_token balance changes). */
  refreshProfile: () => Promise<void>
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Shared across React StrictMode double-mounts so we never create two
// anonymous users for the same browser.
let anonymousSignIn: Promise<Session> | null = null

function signInAnonymously(): Promise<Session> {
  if (!anonymousSignIn) {
    anonymousSignIn = supabase.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error || !data.session) {
          const hint =
            import.meta.env.DEV && error?.message
              ? /anonymous/i.test(error.message)
                ? ' Enable Anonymous Sign-Ins in Supabase (Authentication → Sign In / Providers).'
                : /database error/i.test(error.message)
                  ? ' Apply supabase/migrations/002_fix_policies.sql.'
                  : ''
              : ''
          throw toAppError(error, 'Authentication failed.' + hint)
        }
        return data.session
      })
      .finally(() => {
        anonymousSignIn = null
      })
  }
  return anonymousSignIn
}

/**
 * Returns a verified user id: reuses the stored session when the server still
 * accepts it, otherwise signs in anonymously.
 */
async function ensureAuthenticatedUserId(onSigningIn: () => void): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toAppError(error, 'Authentication failed.')

  if (data.session) {
    // getUser() validates the token with Supabase rather than trusting local storage.
    const { data: verified, error: verifyError } = await supabase.auth.getUser()
    if (!verifyError && verified.user) return verified.user.id

    // Stored session is no longer valid (e.g. user deleted in the dashboard).
    console.warn('[Auth] Stored session rejected, signing in again:', verifyError?.message)
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
    if (signOutError) throw toAppError(signOutError, 'Authentication failed.')
  }

  onSigningIn()
  const session = await signInAnonymously()
  return session.user.id
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const userIdRef = useRef<string | null>(null)
  // True while initialize() runs, so auth events it causes itself are ignored.
  const initializingRef = useRef(false)

  const loadProfile = useCallback(async (userId: string) => {
    userIdRef.current = userId
    setStatus('loading_profile')
    const profile = await fetchProfile(userId)
    setUser(profile)
    setStatus('ready')
  }, [])

  const initialize = useCallback(async () => {
    initializingRef.current = true
    setError(null)
    setStatus('initializing')
    try {
      if (supabaseConfigError) throw new AppError(supabaseConfigError)
      const userId = await ensureAuthenticatedUserId(() => setStatus('signing_in'))
      await loadProfile(userId)
    } catch (err) {
      setUser(null)
      userIdRef.current = null
      setError(getErrorMessage(err, 'Authentication failed.'))
      setStatus('error')
    } finally {
      initializingRef.current = false
    }
  }, [loadProfile])

  useEffect(() => {
    let cancelled = false
    initialize()

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer work: calling Supabase inside this callback can deadlock the client.
      setTimeout(() => {
        if (cancelled || initializingRef.current) return
        switch (event) {
          case 'SIGNED_OUT':
            // Anonymous-only MVP: start a fresh anonymous session.
            setUser(null)
            userIdRef.current = null
            initialize()
            break
          case 'SIGNED_IN':
          case 'USER_UPDATED':
            if (session?.user && session.user.id !== userIdRef.current) {
              loadProfile(session.user.id).catch((err) => {
                setError(getErrorMessage(err, 'Unable to load your profile.'))
                setStatus('error')
              })
            }
            break
          case 'TOKEN_REFRESHED':
            // Session is refreshed and persisted by supabase-js; nothing to reload.
            break
        }
      }, 0)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [initialize, loadProfile, attempt])

  const refreshProfile = useCallback(async () => {
    if (!userIdRef.current) return
    const profile = await fetchProfile(userIdRef.current)
    setUser(profile)
  }, [])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return (
    <AuthContext.Provider value={{ status, user, error, refreshProfile, retry }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
