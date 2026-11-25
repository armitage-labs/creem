import { CreemError, CustomerCreditsErrorResponseDto } from 'creem/models/errors'
import { InsufficientBalanceError, ModerationDebitError } from './types'

/** Creem's machine-readable error code (`insufficient_balance`, `moderation_denied`, ...), if any. */
export function errorCode(err: unknown): string | null {
  if (err instanceof CustomerCreditsErrorResponseDto) return err.error.code
  // The SDK only types 409 and 422 responses. Other statuses (a 400 for most
  // `moderation_*` codes) arrive as a plain CreemError with the raw JSON body.
  if (!(err instanceof CreemError)) return null
  try {
    const code: unknown = JSON.parse(err.body)?.error?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/**
 * Map a failed debit onto the app's typed errors. Anything Creem did not give a
 * known code for is returned unchanged, so the caller reports it as a billing error.
 */
export function toDebitError(err: unknown): unknown {
  const code = errorCode(err)
  if (code === 'insufficient_balance') return new InsufficientBalanceError()
  if (code?.startsWith('moderation_')) return new ModerationDebitError(code)
  return err
}
