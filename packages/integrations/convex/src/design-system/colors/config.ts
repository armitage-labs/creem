export const COLOR_STEPS = [
  0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
] as const;

export type ColorStep = (typeof COLOR_STEPS)[number];

export type Palette = {
  id: string;
  name: string;
  colors: Record<ColorStep, string>; // oklch(...)
};

export type ColorRef = {
  paletteId: string;
  step: ColorStep;
};

export type SemanticRoleModeMap = {
  light: ColorRef;
  dark: ColorRef;
};

export type StateLayerRef = {
  light: ColorRef;
  dark: ColorRef;
  opacityLight: number;
  opacityDark: number;
};

const ref = (paletteId: string, step: ColorStep): ColorRef => ({
  paletteId,
  step,
});
const role = (light: ColorRef, dark: ColorRef): SemanticRoleModeMap => ({
  light,
  dark,
});

export const DEFAULT_PALETTES: Palette[] = [
  {
    id: "neutral",
    name: "Neutral",
    colors: {
      0: "oklch(0.2404 0.0015 17.26)",
      10: "oklch(0.2861 0.0015 17.24)",
      20: "oklch(0.3300 0.0014 17.23)",
      30: "oklch(0.3562 0.0000 89.88)",
      40: "oklch(0.3942 0.0000 89.88)",
      50: "oklch(0.4640 0.0000 89.88)",
      60: "oklch(0.6066 0.0000 89.88)",
      70: "oklch(0.7252 0.0000 89.88)",
      80: "oklch(0.7889 0.0000 89.88)",
      90: "oklch(0.8853 0.0000 89.88)",
      100: "oklch(0.9067 0.0000 89.88)",
      110: "oklch(0.9249 0.0000 89.88)",
      120: "oklch(0.9461 0.0000 89.88)",
      130: "oklch(0.9612 0.0000 89.88)",
      140: "oklch(0.9851 0.0000 89.88)",
    },
  },
  {
    id: "primary",
    name: "Primary",
    colors: {
      0: "oklch(0.2393 0.1035 267.86)",
      10: "oklch(0.2779 0.1284 267.40)",
      20: "oklch(0.3486 0.1710 266.59)",
      30: "oklch(0.3887 0.1943 266.54)",
      40: "oklch(0.4603 0.2332 266.15)",
      50: "oklch(0.5075 0.2521 266.56)",
      60: "oklch(0.5572 0.2221 268.76)",
      70: "oklch(0.6180 0.1883 271.07)",
      80: "oklch(0.6986 0.1411 273.24)",
      90: "oklch(0.8270 0.0785 274.99)",
      100: "oklch(0.8795 0.0545 276.10)",
      110: "oklch(0.9165 0.0373 275.70)",
      120: "oklch(0.9389 0.0262 274.11)",
      130: "oklch(0.9577 0.0189 279.53)",
      140: "oklch(0.9766 0.0096 273.36)",
    },
  },
  {
    id: "success",
    name: "Success",
    colors: {
      0: "oklch(0.2481 0.0527 149.95)",
      10: "oklch(0.3087 0.0659 149.58)",
      20: "oklch(0.3659 0.0802 149.07)",
      30: "oklch(0.4447 0.1057 147.39)",
      40: "oklch(0.5150 0.1252 146.76)",
      50: "oklch(0.5858 0.1454 146.29)",
      60: "oklch(0.6549 0.1305 147.84)",
      70: "oklch(0.7268 0.1093 149.35)",
      80: "oklch(0.8069 0.0778 152.59)",
      90: "oklch(0.8877 0.0484 154.56)",
      100: "oklch(0.9200 0.0369 150.26)",
      110: "oklch(0.9447 0.0259 150.77)",
      120: "oklch(0.9637 0.0190 152.82)",
      130: "oklch(0.9794 0.0132 152.61)",
      140: "oklch(0.9922 0.0074 151.89)",
    },
  },
  {
    id: "warning",
    name: "Warning",
    colors: {
      0: "oklch(0.2693 0.0489 78.79)",
      10: "oklch(0.3310 0.0619 77.75)",
      20: "oklch(0.3960 0.0765 75.73)",
      30: "oklch(0.4747 0.0942 74.38)",
      40: "oklch(0.5523 0.1110 74.37)",
      50: "oklch(0.6273 0.1267 74.22)",
      60: "oklch(0.7054 0.1250 77.42)",
      70: "oklch(0.7718 0.1075 79.76)",
      80: "oklch(0.8384 0.0836 81.23)",
      90: "oklch(0.9071 0.0556 83.98)",
      100: "oklch(0.9344 0.0423 85.96)",
      110: "oklch(0.9520 0.0313 84.59)",
      120: "oklch(0.9696 0.0204 81.78)",
      130: "oklch(0.9827 0.0126 86.83)",
      140: "oklch(0.9945 0.0057 84.57)",
    },
  },
  {
    id: "error",
    name: "Error",
    colors: {
      0: "oklch(0.2397 0.0707 17.94)",
      10: "oklch(0.2928 0.0940 18.41)",
      20: "oklch(0.3560 0.1189 19.66)",
      30: "oklch(0.4207 0.1444 20.13)",
      40: "oklch(0.4841 0.1679 20.24)",
      50: "oklch(0.5450 0.1913 19.79)",
      60: "oklch(0.6051 0.1741 15.61)",
      70: "oklch(0.6835 0.1350 11.37)",
      80: "oklch(0.7805 0.0854 9.02)",
      90: "oklch(0.8817 0.0426 5.18)",
      100: "oklch(0.9172 0.0294 4.55)",
      110: "oklch(0.9412 0.0213 3.09)",
      120: "oklch(0.9577 0.0154 7.49)",
      130: "oklch(0.9725 0.0110 3.49)",
      140: "oklch(0.9870 0.0065 5.62)",
    },
  },
];

export const SEMANTIC_ROLE_ORDER = [
  "surface.base",
  "surface.subtle",
  "surface.elevated",
  "surface.tonal",
  "surface.filled",
  "surface.backdrop",
  "border.subtle",
  "border.default",
  "foreground.default",
  "foreground.muted",
  "foreground.placeholder",
  "foreground.on-filled",
  "foreground.on-tonal",
  "surface.inverse",
  "foreground.on-inverse-primary",
  "foreground.on-inverse-secondary",
] as const;

export type SemanticRole = (typeof SEMANTIC_ROLE_ORDER)[number];

export const DEFAULT_SEMANTIC_ROLES: Record<SemanticRole, SemanticRoleModeMap> =
  {
    // Surface
    "surface.base": role(ref("neutral", 140), ref("neutral", 0)),
    "surface.subtle": role(ref("neutral", 130), ref("neutral", 10)),
    "surface.elevated": role(ref("neutral", 120), ref("neutral", 20)),
    "surface.tonal": role(ref("neutral", 110), ref("neutral", 30)),
    "surface.filled": role(ref("neutral", 10), ref("neutral", 130)),
    "surface.backdrop": role(ref("neutral", 70), ref("neutral", 30)),

    // Border
    "border.subtle": role(ref("neutral", 100), ref("neutral", 40)),
    "border.default": role(ref("neutral", 90), ref("neutral", 50)),

    // Foreground
    "foreground.default": role(ref("neutral", 0), ref("neutral", 140)),
    "foreground.muted": role(ref("neutral", 50), ref("neutral", 90)),
    "foreground.placeholder": role(ref("neutral", 70), ref("neutral", 60)),
    "foreground.on-filled": role(ref("neutral", 140), ref("neutral", 0)),
    "foreground.on-tonal": role(ref("neutral", 10), ref("neutral", 130)),

    // Inverse
    "surface.inverse": role(ref("neutral", 0), ref("neutral", 140)),
    "foreground.on-inverse-primary": role(
      ref("neutral", 140),
      ref("neutral", 0),
    ),
    "foreground.on-inverse-secondary": role(
      ref("neutral", 80),
      ref("neutral", 50),
    ),
  };

// Palette-specific semantic-role overrides when a palette does not follow
// the default neutral step mapping 1:1.
export const PALETTE_SEMANTIC_ROLE_OVERRIDES: Partial<
  Record<string, Partial<Record<SemanticRole, SemanticRoleModeMap>>>
> = {
  primary: {
    "surface.base": role(ref("primary", 140), ref("primary", 0)),
    "surface.subtle": role(ref("primary", 130), ref("primary", 10)),
    "surface.elevated": role(ref("primary", 120), ref("primary", 20)),
    "surface.tonal": role(ref("primary", 110), ref("primary", 30)),
    "surface.filled": role(ref("primary", 60), ref("primary", 70)),

    "border.subtle": role(ref("primary", 100), ref("primary", 40)),
    "border.default": role(ref("primary", 90), ref("primary", 50)),

    "foreground.default": role(ref("primary", 10), ref("primary", 130)),
    "foreground.muted": role(ref("primary", 30), ref("primary", 110)),
    "foreground.placeholder": role(ref("primary", 40), ref("primary", 100)),
    "foreground.on-tonal": role(ref("primary", 60), ref("primary", 90)),
    "foreground.on-filled": role(ref("primary", 140), ref("primary", 0)),

    "surface.inverse": role(ref("primary", 0), ref("primary", 140)),
    "foreground.on-inverse-primary": role(
      ref("primary", 140),
      ref("primary", 0),
    ),
    "foreground.on-inverse-secondary": role(
      ref("primary", 80),
      ref("primary", 50),
    ),
  },
};

export const STATE_LAYER_ORDER = [
  "hover",
  "pressed",
  "focus-ring",
  "border-active",
  "drag",
  "disabled",
] as const;
export type StateLayerRole = (typeof STATE_LAYER_ORDER)[number];

export const DEFAULT_STATE_LAYERS: Record<
  StateLayerRole,
  StateLayerRef | { opacityLight: number; opacityDark: number }
> = {
  hover: {
    light: ref("neutral", 0),
    dark: ref("neutral", 140),
    opacityLight: 8,
    opacityDark: 8,
  },
  pressed: {
    light: ref("neutral", 0),
    dark: ref("neutral", 140),
    opacityLight: 10,
    opacityDark: 10,
  },
  "focus-ring": {
    light: ref("neutral", 60),
    dark: ref("neutral", 60),
    opacityLight: 100,
    opacityDark: 100,
  },
  "border-active": {
    light: ref("neutral", 40),
    dark: ref("neutral", 90),
    opacityLight: 100,
    opacityDark: 100,
  },
  drag: {
    light: ref("neutral", 0),
    dark: ref("neutral", 140),
    opacityLight: 16,
    opacityDark: 16,
  },
  disabled: {
    opacityLight: 50,
    opacityDark: 50,
  },
};
