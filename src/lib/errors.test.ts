import { describe, expect, it, vi } from 'vitest'
import { AppError, getErrorMessage, toAppError } from './errors'

describe('toAppError', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})

  it('uses the caller-supplied message for generic database errors', () => {
    const err = toAppError({ code: '23505', message: 'duplicate key value', details: 'Key (id)=(1)' }, 'Unable to save card.')
    expect(err).toBeInstanceOf(AppError)
    expect(err.message).toBe('Unable to save card.')
    expect(err.code).toBe('23505')
  })

  it('maps RLS / permission errors to a permission message', () => {
    const err = toAppError({ code: '42501', message: 'new row violates row-level security policy' }, 'Unable to save card.')
    expect(err.message).toBe("You don't have permission to perform this action.")
  })

  it('surfaces the server message for insufficient kb_token balance', () => {
    const err = toAppError(
      { code: 'P0001', message: 'Insufficient kb_token balance. Required: 10, available: 5', hint: 'insufficient_kb_tokens' },
      'Your AI token balance could not be updated.'
    )
    expect(err.message).toBe('Insufficient kb_token balance. Required: 10, available: 5')
  })

  it('maps network failures to a connection message', () => {
    const err = toAppError(new TypeError('Failed to fetch'), 'Unable to load workspaces.')
    expect(err.message).toMatch(/Can't reach the server/)
  })

  it('does not leak raw database details into the user message', () => {
    const err = toAppError({ code: 'XX000', message: 'relation "secret_table" does not exist' }, 'Unable to load board.')
    expect(err.message).not.toContain('secret_table')
  })

  it('returns AppError instances unchanged', () => {
    const original = new AppError('Already friendly')
    expect(toAppError(original, 'other')).toBe(original)
  })
})

describe('getErrorMessage', () => {
  it('returns the AppError message', () => {
    expect(getErrorMessage(new AppError('Unable to save card.'))).toBe('Unable to save card.')
  })

  it('falls back for unknown errors instead of leaking them', () => {
    expect(getErrorMessage(new Error('stack trace internals'), 'Fallback')).toBe('Fallback')
  })
})
