import { Marked } from "marked";

const marked = new Marked({
  async: false,
  gfm: true,
  breaks: true,
});

/**
 * Render a markdown string to HTML.
 * Intended for short product/plan descriptions synced from Creem.
 * Returns an empty string for nullish input.
 */
export function renderMarkdown(md: string | undefined | null): string {
  if (!md) return "";
  return marked.parse(md) as string;
}

/**
 * Render a markdown string to inline HTML (no wrapping `<p>` tags).
 * Useful for single-line titles or short labels.
 */
export function renderMarkdownInline(md: string | undefined | null): string {
  if (!md) return "";
  return marked.parseInline(md) as string;
}
