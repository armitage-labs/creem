export function normalizeHex(input: string): string {
  const raw = input.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9A-F]{3}$/.test(raw))
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`;
  return "#000000";
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clampChannel(n: number): number {
  return Math.round(clamp01(n) * 255);
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

export function hexToOklch(hexInput: string): string {
  const hex = normalizeHex(hexInput);
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + b2 * b2);
  let h = (Math.atan2(b2, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${h.toFixed(2)})`;
}

export function parseOklch(
  input: string,
): { l: number; c: number; h: number } | null {
  const m = input
    .trim()
    .match(
      /^oklch\(\s*([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)(?:deg)?\s*\)$/i,
    );
  if (!m) return null;
  const l = Number(m[1]);
  const c = Number(m[2]);
  const h = Number(m[3]);
  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h))
    return null;
  return { l, c, h };
}

export function normalizeOklch(input: string): string {
  const parsed = parseOklch(input);
  if (!parsed) return input;
  const h = ((parsed.h % 360) + 360) % 360;
  return `oklch(${parsed.l.toFixed(4)} ${parsed.c.toFixed(4)} ${h.toFixed(2)})`;
}

export function oklchToHex(input: string): string {
  const parsed = parseOklch(input);
  if (!parsed) return "#000000";

  const hRad = (parsed.h * Math.PI) / 180;
  const a = parsed.c * Math.cos(hRad);
  const b = parsed.c * Math.sin(hRad);

  const l_ = parsed.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = parsed.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = parsed.l - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const r = clampChannel(linearToSrgb(lr));
  const g = clampChannel(linearToSrgb(lg));
  const bHex = clampChannel(linearToSrgb(lb));

  return `#${toHex(r)}${toHex(g)}${toHex(bHex)}`;
}
