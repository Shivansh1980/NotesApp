import { describe, expect, it } from "vitest";

import {
  containsLatexMath,
  extractDisplayLatex,
  latexTextToBlocks,
  renderLatexToHtml,
  renderedMathTextToLatex
} from "./mathUtils";

describe("mathUtils", () => {
  it("detects inline and display latex", () => {
    expect(containsLatexMath("Energy is $E = mc^2$")).toBe(true);
    expect(extractDisplayLatex("$$\\frac{a}{b}$$")).toBe("\\frac{a}{b}");
  });

  it("converts display math into an equation block", () => {
    const blocks = latexTextToBlocks("$$E = mc^2$$");
    expect(blocks[0]?.type).toBe("math");
    expect(blocks[0]?.props?.latex).toBe("E = mc^2");
  });

  it("renders latex through katex html", () => {
    expect(renderLatexToHtml("E = mc^2")).toContain("katex");
  });

  it("converts compact rendered math text into latex", () => {
    expect(renderedMathTextToLatex("tᵢ → E[tᵢ] = xᵢ")).toBe("t_{i} \\to E[t_{i}] = x_{i}");
    expect(renderedMathTextToLatex("Text → Tokens → Token IDs → Embeddings")).toBeNull();
  });
});
