// Consistent error handling for Supabase/database calls.
//
// AppError.message is always safe to show to end users. The raw database
// error (code, details, hint) is kept on `cause` and logged in development.

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string | null
  hint?: string | null
  status?: number
}

export class AppError extends Error {
  readonly code?: string
  readonly cause?: unknown

  constructor(message: string, options: { code?: string; cause?: unknown } = {}) {
    super(message)
    this.name = 'AppError'
    this.code = options.code
    this.cause = options.cause
  }
}

const PERMISSION_CODES = new Set(['42501', 'PGRST301', '401', '403'])

function friendlyMessage(err: SupabaseLikeError, fallback: string): string {
  if (err.hint === 'insufficient_kb_tokens' && err.message) return err.message
  if (err.code && PERMISSION_CODES.has(err.code)) return "You don't have permission to perform this action."
  if (err.message && /failed to fetch|network/i.test(err.message)) {
    return "Can't reach the server. Check your connection and try again."
  }
  return fallback
}

/** Wraps any thrown value / Supabase error in an AppError with a user-facing message. */
export function toAppError(error: unknown, userMessage: string): AppError {
  if (error instanceof AppError) return error

  const err = (error ?? {}) as SupabaseLikeError
  const appError = new AppError(friendlyMessage(err, userMessage), { code: err.code, cause: error })

  if (import.meta.env.DEV) {
    console.error(`[Supabase] ${userMessage}`, {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint,
      status: err.status,
    })
  } else {
    console.error(`[Supabase] ${userMessage}`, err.code ?? '')
  }

  return appError
}

/** Returns a message suitable for the UI from any caught value. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof AppError ? error.message : fallback
}
