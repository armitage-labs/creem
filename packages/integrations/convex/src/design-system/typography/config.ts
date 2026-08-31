export type ViewportKey = "desktop" | "tablet" | "mobile";
export type RoleGroup =
  | "display"
  | "heading"
  | "title"
  | "subtitle"
  | "body"
  | "label"
  | "button"
  | "link";

export type TypefaceKey = "brand" | "plain";

export type RoleDefinition = {
  id: string;
  label: string;
  group: RoleGroup;
  typeface: TypefaceKey;
  defaultStep: number;
  desktopSizePx: number;
  desktopLineHeightPx: number;
  defaultWeight: number;
  responsive: boolean;
};

export type TypeScaleOption = {
  label: string;
  value: number;
};

export const TYPE_SCALE_OPTIONS: TypeScaleOption[] = [
  { label: "Minor Second", value: 1.067 },
  { label: "Major Second", value: 1.125 },
  { label: "Minor Third", value: 1.2 },
  { label: "Major Third", value: 1.25 },
  { label: "Perfect Fourth", value: 1.333 },
];

export const TYPOGRAPHY_FOUNDATION = {
  base: {
    desktop: 16,
    tablet: 13,
    mobile: 10,
  },
  responsiveRatio: {
    tablet: 13 / 16,
    mobile: 10 / 16,
  },
  breakpoints: {
    tabletMin: 640,
    tabletMax: 1023,
    mobileMax: 639,
  },
  typefaces: {
    brand: "Inter, sans-serif",
    plain: "Inter, sans-serif",
  },
} as const;

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: "display-l",
    label: "Display L",
    group: "display",
    typeface: "brand",
    defaultStep: 8,
    desktopSizePx: 95,
    desktopLineHeightPx: 97,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "display-m",
    label: "Display M",
    group: "display",
    typeface: "brand",
    defaultStep: 7,
    desktopSizePx: 76,
    desktopLineHeightPx: 83.6,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "display-s",
    label: "Display S",
    group: "display",
    typeface: "brand",
    defaultStep: 6,
    desktopSizePx: 61,
    desktopLineHeightPx: 67.1,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "heading-l",
    label: "Heading L",
    group: "heading",
    typeface: "brand",
    defaultStep: 5,
    desktopSizePx: 49,
    desktopLineHeightPx: 53.9,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "heading-m",
    label: "Heading M",
    group: "heading",
    typeface: "brand",
    defaultStep: 4,
    desktopSizePx: 39,
    desktopLineHeightPx: 42.9,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "heading-s",
    label: "Heading S",
    group: "heading",
    typeface: "brand",
    defaultStep: 3,
    desktopSizePx: 31,
    desktopLineHeightPx: 34.1,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "heading-xs",
    label: "Heading XS",
    group: "heading",
    typeface: "brand",
    defaultStep: 2,
    desktopSizePx: 25,
    desktopLineHeightPx: 27.5,
    defaultWeight: 600,
    responsive: true,
  },
  {
    id: "title-l",
    label: "Title L",
    group: "title",
    typeface: "brand",
    defaultStep: 2,
    desktopSizePx: 25,
    desktopLineHeightPx: 30,
    defaultWeight: 600,
    responsive: false,
  },
  {
    id: "title-m",
    label: "Title M",
    group: "title",
    typeface: "brand",
    defaultStep: 1,
    desktopSizePx: 20,
    desktopLineHeightPx: 24,
    defaultWeight: 600,
    responsive: false,
  },
  {
    id: "title-s",
    label: "Title S",
    group: "title",
    typeface: "brand",
    defaultStep: 0,
    desktopSizePx: 16,
    desktopLineHeightPx: 20,
    defaultWeight: 600,
    responsive: false,
  },
  {
    id: "subtitle-l",
    label: "Subtitle L",
    group: "subtitle",
    typeface: "plain",
    defaultStep: 2,
    desktopSizePx: 25,
    desktopLineHeightPx: 37.5,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "subtitle-m",
    label: "Subtitle M",
    group: "subtitle",
    typeface: "plain",
    defaultStep: 1,
    desktopSizePx: 20,
    desktopLineHeightPx: 30,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "body-l",
    label: "Body L",
    group: "body",
    typeface: "plain",
    defaultStep: 0,
    desktopSizePx: 16,
    desktopLineHeightPx: 24,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "body-m",
    label: "Body M",
    group: "body",
    typeface: "plain",
    defaultStep: -1,
    desktopSizePx: 14,
    desktopLineHeightPx: 19.5,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "body-s",
    label: "Body S",
    group: "body",
    typeface: "plain",
    defaultStep: -2,
    desktopSizePx: 11,
    desktopLineHeightPx: 16,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "label-l",
    label: "Label L",
    group: "label",
    typeface: "plain",
    defaultStep: 0,
    desktopSizePx: 16,
    desktopLineHeightPx: 24,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "label-m",
    label: "Label M",
    group: "label",
    typeface: "plain",
    defaultStep: -1,
    desktopSizePx: 14,
    desktopLineHeightPx: 19.5,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "label-s",
    label: "Label S",
    group: "label",
    typeface: "plain",
    defaultStep: -2,
    desktopSizePx: 11,
    desktopLineHeightPx: 16,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "button-l",
    label: "Button L",
    group: "button",
    typeface: "plain",
    defaultStep: 0,
    desktopSizePx: 16,
    desktopLineHeightPx: 24,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "button-m",
    label: "Button M",
    group: "button",
    typeface: "plain",
    defaultStep: -1,
    desktopSizePx: 14,
    desktopLineHeightPx: 19.5,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "button-s",
    label: "Button S",
    group: "button",
    typeface: "plain",
    defaultStep: -2,
    desktopSizePx: 11,
    desktopLineHeightPx: 16,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "link-l",
    label: "Link L",
    group: "link",
    typeface: "plain",
    defaultStep: 0,
    desktopSizePx: 16,
    desktopLineHeightPx: 24,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "link-m",
    label: "Link M",
    group: "link",
    typeface: "plain",
    defaultStep: -1,
    desktopSizePx: 14,
    desktopLineHeightPx: 19.5,
    defaultWeight: 400,
    responsive: false,
  },
  {
    id: "link-s",
    label: "Link S",
    group: "link",
    typeface: "plain",
    defaultStep: -2,
    desktopSizePx: 11,
    desktopLineHeightPx: 16,
    defaultWeight: 400,
    responsive: false,
  },
];

export const SEMANTIC_TEXT_TOKENS = {
  "content.hero": "display-l",
  "content.page-title": "heading-l",
  "content.section-title": "heading-s",
  "content.subsection-title": "title-m",
  "content.body.default": "body-m",
  "content.body.compact": "body-s",
  "control.button.primary": "button-m",
  "control.button.secondary": "button-s",
  "control.label.field": "label-m",
  "control.label.group": "label-l",
  "navigation.link.primary": "link-m",
  "navigation.link.subtle": "link-s",
} as const;
