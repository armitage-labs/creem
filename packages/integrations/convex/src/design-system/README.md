# Design System

Foundation-first design system structure.

## Structure

- `typography/config.ts` - base numbers, steps, typefaces, role definitions,
  semantic alias map.
- `typography/tokens.ts` - computed typography tokens (desktop/tablet/mobile)
  and helpers for future export pipelines.
- `typography/utilities.css` - Tailwind-friendly utility classes (`.display-l`,
  `.body-m`, etc.) and CSS variables.
- `colors/config.ts` - semantic palettes, semantic role defaults (light/dark),
  and state layer defaults.
- `colors/index.ts` - typed exports for color foundation configuration.
- `colors/utilities.css` - semantic color variables plus utility classes for
  base and palette-prefixed intent roles.
- `base.css` - global defaults (`surface.base` page background +
  `foreground.default` + Body L text styles).
- `rounded/config.ts` - semantic border radius roles, component defaults, and
  component naming helpers.
- `rounded/utilities.css` - semantic radius utility classes (`radius-s`,
  `radius-m`, etc.).
- `index.css` - aggregate stylesheet entry for the design system.

## Notes

- Responsive recalculation is applied only to `Display` and `Heading` roles.
- Other roles keep desktop values across breakpoints.
- Typeface and default weight are tokenized per family:
  `--et-typeface-brand/plain` and `--et-font-weight-brand/plain`.
- Color utility convention:
- Canonical: `bg-surface-base`, `text-foreground-default`,
  `border-border-default`.
- Intent canonical: `bg-primary-surface-base`,
  `text-success-foreground-default`.
- Shortcut utilities (property-inferred): `surface-base`, `foreground-default`,
  `primary-surface-base`.
- Values are temporary defaults and are expected to be replaced by Figma-sourced
  values later.
