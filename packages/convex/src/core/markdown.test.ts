import { describe, expect, it } from "vitest";
import { renderMarkdown, renderMarkdownInline } from "./markdown.js";

describe("renderMarkdown", () => {
  it("renders basic markdown to HTML", () => {
    const result = renderMarkdown("**bold** text");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).toContain("text");
  });

  it("returns empty string for null input", () => {
    expect(renderMarkdown(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(renderMarkdown(undefined)).toBe("");
  });

  it("returns empty string for empty string input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("renders GFM line breaks", () => {
    const result = renderMarkdown("line1\nline2");
    expect(result).toContain("<br");
  });

  it("renders GFM tables", () => {
    const result = renderMarkdown(
      "| col1 | col2 |\n| --- | --- |\n| a | b |",
    );
    expect(result).toContain("<table>");
    expect(result).toContain("<th>");
    expect(result).toContain("<td>");
  });

  it("preserves emoji characters like checkmarks and crosses", () => {
    const result = renderMarkdown("\u2714\uFE0F feature A\n\u274C feature B");
    expect(result).toContain("\u2714");
    expect(result).toContain("\u274C");
  });
});

describe("renderMarkdownInline", () => {
  it("renders inline markdown without wrapping p tags", () => {
    const result = renderMarkdownInline("**bold** text");
    expect(result).toContain("<strong>bold</strong>");
    expect(result).not.toContain("<p>");
  });

  it("returns empty string for null input", () => {
    expect(renderMarkdownInline(null)).toBe("");
  });

  it("returns empty string for undefined input", () => {
    expect(renderMarkdownInline(undefined)).toBe("");
  });
});
