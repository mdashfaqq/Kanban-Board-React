import { supabase } from '../lib/supabase'
import { AppError, toAppError } from '../lib/errors'

/** Profile row from public.users, keyed by the Supabase Auth user id (UUID). */
export interface User {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  kb_token_balance: number
}

/**
 * Returns the signed-in user's id from the current Supabase session.
 * Services use this instead of accepting a user id from callers, so a caller
 * can never act as someone else (RLS enforces the same via auth.uid()).
 */
export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toAppError(error, 'Authentication failed.')
  const userId = data.session?.user.id
  if (!userId) throw new AppError('You are not signed in yet. Please wait a moment and try again.', { code: 'not_authenticated' })
  return userId
}

export async function fetchProfile(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, avatar_url, kb_token_balance')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw toAppError(error, 'Unable to load your profile.')
  if (!data) {
    throw new AppError(
      import.meta.env.DEV
        ? 'Your user profile is missing. Apply supabase/migrations/002_fix_policies.sql and reload.'
        : 'Unable to load your profile.',
      { code: 'profile_missing' }
    )
  }
  return data as User
}
