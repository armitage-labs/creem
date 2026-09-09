declare module 'framer' {
  import type { ComponentType } from 'react'

  export const RenderTarget: {
    current: () => unknown
    readonly canvas: unknown
    readonly preview: unknown
    readonly export: unknown
  }

  export const ControlType: Record<string, string>

  export function addPropertyControls(component: ComponentType<any>, controls: Record<string, unknown>): void
}
