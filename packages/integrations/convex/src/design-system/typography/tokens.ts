import {
  ROLE_DEFINITIONS,
  SEMANTIC_TEXT_TOKENS,
  TYPOGRAPHY_FOUNDATION,
  type RoleDefinition,
  type RoleGroup,
  type ViewportKey,
} from "./config.js";

export type ResolvedRoleToken = {
  id: string;
  label: string;
  group: RoleGroup;
  typeface: "brand" | "plain";
  responsive: boolean;
  fontWeight: number;
  fontSize: Record<ViewportKey, number>;
  lineHeight: Record<ViewportKey, number>;
  tracking: Record<ViewportKey, number>;
  future: Record<string, string | number | boolean>;
};

const VIEWPORTS: ViewportKey[] = ["desktop", "tablet", "mobile"];

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function toRem(px: number): string {
  const rem = px / 16;
  return `${round(rem)}rem`;
}

function trackingFromSize(size: number): number {
  if (size >= 90) return -3.5;
  if (size >= 75) return -2.8;
  if (size >= 60) return -2.2;
  if (size >= 48) return -1.8;
  if (size >= 38) return -1.4;
  if (size >= 30) return -1;
  if (size >= 24) return -0.6;
  if (size >= 20) return -0.3;
  return 0;
}

function viewportRatio(viewport: ViewportKey): number {
  if (viewport === "tablet")
    return TYPOGRAPHY_FOUNDATION.responsiveRatio.tablet;
  if (viewport === "mobile")
    return TYPOGRAPHY_FOUNDATION.responsiveRatio.mobile;
  return 1;
}

function resolveViewportSize(
  role: RoleDefinition,
  viewport: ViewportKey,
): number {
  if (!role.responsive || viewport === "desktop") return role.desktopSizePx;
  return round(role.desktopSizePx * viewportRatio(viewport));
}

function resolveViewportLineHeight(
  role: RoleDefinition,
  viewport: ViewportKey,
): number {
  if (!role.responsive || viewport === "desktop")
    return role.desktopLineHeightPx;
  return round(role.desktopLineHeightPx * viewportRatio(viewport));
}

function resolveRole(role: RoleDefinition): ResolvedRoleToken {
  const sizeByViewport = {
    desktop: resolveViewportSize(role, "desktop"),
    tablet: resolveViewportSize(role, "tablet"),
    mobile: resolveViewportSize(role, "mobile"),
  };

  const lineHeightByViewport = {
    desktop: resolveViewportLineHeight(role, "desktop"),
    tablet: resolveViewportLineHeight(role, "tablet"),
    mobile: resolveViewportLineHeight(role, "mobile"),
  };

  const trackingByViewport = {
    desktop: trackingFromSize(sizeByViewport.desktop),
    tablet: trackingFromSize(sizeByViewport.tablet),
    mobile: trackingFromSize(sizeByViewport.mobile),
  };
  if (role.id === "display-s") {
    trackingByViewport.desktop = -3;
  }

  return {
    id: role.id,
    label: role.label,
    group: role.group,
    typeface: role.typeface,
    responsive: role.responsive,
    fontWeight: role.defaultWeight,
    fontSize: sizeByViewport,
    lineHeight: lineHeightByViewport,
    tracking: trackingByViewport,
    future: {},
  };
}

export const typographyRoles: ResolvedRoleToken[] =
  ROLE_DEFINITIONS.map(resolveRole);

export const typographyById = Object.fromEntries(
  typographyRoles.map((role) => [role.id, role]),
);

export const semanticTypography = Object.fromEntries(
  Object.entries(SEMANTIC_TEXT_TOKENS).map(([semanticName, roleId]) => [
    semanticName,
    typographyById[roleId as string],
  ]),
);

export function toCssVariables(
  role: ResolvedRoleToken,
): Record<string, string> {
  const vars: Record<string, string> = {
    [`--et-type-${role.id}-font-family`]: `var(--et-typeface-${role.typeface})`,
    [`--et-type-${role.id}-font-weight`]: String(role.fontWeight),
  };

  for (const viewport of VIEWPORTS) {
    vars[`--et-type-${role.id}-size-${viewport}`] = toRem(
      role.fontSize[viewport],
    );
    vars[`--et-type-${role.id}-line-height-${viewport}`] = toRem(
      role.lineHeight[viewport],
    );
    vars[`--et-type-${role.id}-tracking-${viewport}`] = toRem(
      role.tracking[viewport],
    );
  }

  return vars;
}

export const typographyCssVariableMap = typographyRoles.reduce<
  Record<string, string>
>((acc, role) => {
  return { ...acc, ...toCssVariables(role) };
}, {});
