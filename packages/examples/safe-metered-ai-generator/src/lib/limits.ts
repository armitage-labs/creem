/**
 * Shared request/upload limits, enforced on both the client and the server.
 *
 * This module intentionally has no server-only imports (no env, no db) so it can
 * be pulled into client components as well as API routes.
 */

/**
 * Max size of an uploaded reference image.
 *
 * Kept well under Vercel's 4.5 MB request-body limit: the image is sent inline
 * as a base64 data URL, and base64 inflates the payload by ~33%. So 2.5 MB of
 * image is ~3.4 MB on the wire, leaving headroom for the prompt and other JSON.
 */
export const MAX_IMAGE_BYTES = Math.floor(2.5 * 1024 * 1024)

/** Human-friendly form of {@link MAX_IMAGE_BYTES} for UI/error copy. */
export const MAX_IMAGE_LABEL = '2.5 MB'

/**
 * Decoded byte length of a base64 `data:` URL, computed from the string length
 * (no allocation/decode). Returns `null` if the value isn't a base64 data URL.
 */
export function dataUrlByteLength(dataUrl: string): number | null {
  const comma = dataUrl.indexOf(',')
  if (comma === -1 || !/^data:[^,]*;base64$/i.test(dataUrl.slice(0, comma))) return null
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding)
}
