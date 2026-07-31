import { describe, expect, it } from "vitest";

import { detectCodeLanguage, getCodeBlockRows, highlightCode, looksLikeSourceCode } from "./codeUtils";

describe("codeUtils", () => {
  it("detects common languages for pasted code", () => {
    expect(detectCodeLanguage("const answer: number = 42;\nconsole.log(answer);")).toBe("typescript");
    expect(detectCodeLanguage("def hello():\n    return 1")).toBe("python");
    expect(detectCodeLanguage("SELECT * FROM notes WHERE id = 1")).toBe("sql");
  });

  it("does not treat short comma-separated prose as source code", () => {
    expect(looksLikeSourceCode("dog, airplane, democracy")).toBe(false);
  });

  it("keeps one-line code blocks compact and clamps large snippets", () => {
    expect(getCodeBlockRows("dog, airplane, democracy")).toBe(1);
    expect(getCodeBlockRows("a\nb\nc")).toBe(3);
    expect(getCodeBlockRows(Array.from({ length: 30 }, (_, index) => String(index)).join("\n"))).toBe(18);
  });

  it("highlights tokens without leaking raw html", () => {
    const highlighted = highlightCode("const value = 42;", "javascript");
    expect(highlighted).toContain('class="tok-keyword"');
    expect(highlighted).toContain('class="tok-number"');
    expect(highlighted).not.toContain("<script>");
  });
});
