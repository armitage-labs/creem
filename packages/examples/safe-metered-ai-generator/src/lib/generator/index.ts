import { env } from '../env'
import { StubGenerator } from './stub'

/**
 * The generation backend is a swappable black box. Everything the app needs
 * from a model lives behind this one interface, so you can drop in fal,
 * Replicate, an in-house model, etc. without touching the billing/moderation
 * flow. Select via the GENERATOR env var.
 */
export interface GenerateInput {
  prompt: string
  mediaType: 'image' | 'video'
  /** Optional reference image (data URL) uploaded by the user. */
  imageDataUrl?: string
  /** Style / aspect ratio options from the UI. */
  options?: Record<string, string>
  /** Correlates the model call with the generation record for logs. */
  requestId: string
}

export interface GenerateResult {
  /** URL or data URL of the produced asset. */
  url: string
  mediaType: 'image' | 'video'
  /** Arbitrary provider metadata (model name, seed, timings…). */
  meta?: Record<string, unknown>
}

export interface Generator {
  readonly name: string
  generate(input: GenerateInput): Promise<GenerateResult>
}

let cached: Generator | undefined

export function getGenerator(): Generator {
  if (cached) return cached
  switch (env.generator) {
    // Add real providers here, e.g.:
    //   case 'fal': cached = new FalGenerator(); break
    //   case 'replicate': cached = new ReplicateGenerator(); break
    case 'stub':
    default:
      cached = new StubGenerator()
  }
  return cached
}
