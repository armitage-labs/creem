import { Creem } from 'creem'
import { env } from '../env'

/**
 * A single, shared instance of the official Creem SDK client.
 *
 * The SDK targets the right host automatically from `server` ('test' vs 'prod')
 * and injects the `x-api-key` auth header from `apiKey` on every call, so nothing
 * downstream has to build URLs or headers by hand.
 */
export const creemClient = new Creem({
  apiKey: env.creemApiKey,
  server: env.isTestMode ? 'test' : 'prod',
})
