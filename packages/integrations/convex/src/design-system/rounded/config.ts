export const RADIUS_TOKENS = {
  "rounded-sm": { label: "rounded-sm", px: 6 },
  rounded: { label: "rounded", px: 8 },
  "rounded-lg": { label: "rounded-lg", px: 12 },
  "rounded-xl": { label: "rounded-xl", px: 16 },
  "rounded-full": { label: "rounded-full", px: 9999 },
} as const;

export type RadiusTokenKey = keyof typeof RADIUS_TOKENS;
export type RadiusSemanticRole = "S" | "M" | "L" | "XL" | "Full";

export const SEMANTIC_ROLE_ORDER: RadiusSemanticRole[] = [
  "S",
  "M",
  "L",
  "XL",
  "Full",
];

export const DEFAULT_SEMANTIC_RADIUS_TOKENS: Record<
  RadiusSemanticRole,
  RadiusTokenKey
> = {
  S: "rounded-sm",
  M: "rounded",
  L: "rounded-lg",
  XL: "rounded-xl",
  Full: "rounded-full",
};

export const COMPONENT_ORDER = [
  "checkbox",
  "keyboard-shortcut",
  "tag",
  "badge",
  "small-button",
  "button",
  "menu-item",
  "tab",
  "textarea",
  "input",
  "large-button",
  "card",
  "dropdown",
  "popover",
  "tooltip",
  "modal",
  "drawer",
  "table",
  "image",
  "avatar",
  "toggle",
  "progress-bar",
] as const;

export type RadiusComponent = (typeof COMPONENT_ORDER)[number];

export const DEFAULT_COMPONENT_SEMANTIC: Record<
  RadiusComponent,
  RadiusSemanticRole
> = {
  checkbox: "S",
  "keyboard-shortcut": "S",
  tag: "S",
  badge: "S",
  "small-button": "S",
  button: "M",
  "menu-item": "M",
  tab: "M",
  textarea: "M",
  input: "M",
  "large-button": "L",
  card: "L",
  dropdown: "L",
  popover: "L",
  tooltip: "L",
  modal: "XL",
  drawer: "XL",
  table: "XL",
  image: "L",
  avatar: "Full",
  toggle: "Full",
  "progress-bar": "Full",
};

export function titleizeComponentName(name: RadiusComponent): string {
  return name
    .split("-")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}
