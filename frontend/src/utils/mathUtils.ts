import katex from "katex";

import type { PasteBlock } from "../types/block.types";
import { richText } from "./blockUtils";

type LatexSegment =
  | { type: "text"; value: string }
  | { type: "math"; latex: string; display: boolean; raw: string };

const latexTokenPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^\n$]+\$)/g;
const subscriptCharacters = "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ";
const superscriptCharacters = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁱⁿ";
const subscriptMap: Record<string, string> = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₊": "+",
  "₋": "-",
  "₌": "=",
  "₍": "(",
  "₎": ")",
  "ₐ": "a",
  "ₑ": "e",
  "ₕ": "h",
  "ᵢ": "i",
  "ⱼ": "j",
  "ₖ": "k",
  "ₗ": "l",
  "ₘ": "m",
  "ₙ": "n",
  "ₒ": "o",
  "ₚ": "p",
  "ᵣ": "r",
  "ₛ": "s",
  "ₜ": "t",
  "ᵤ": "u",
  "ᵥ": "v",
  "ₓ": "x"
};
const superscriptMap: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
  "⁼": "=",
  "⁽": "(",
  "⁾": ")",
  "ⁱ": "i",
  "ⁿ": "n"
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function unwrapLatex(raw: string): { latex: string; display: boolean } {
  if (raw.startsWith("$$") && raw.endsWith("$$")) return { latex: raw.slice(2, -2).trim(), display: true };
  if (raw.startsWith("\\[") && raw.endsWith("\\]")) return { latex: raw.slice(2, -2).trim(), display: true };
  if (raw.startsWith("\\(") && raw.endsWith("\\)")) return { latex: raw.slice(2, -2).trim(), display: false };
  return { latex: raw.slice(1, -1).trim(), display: false };
}

function looksLikeLatex(latex: string): boolean {
  return Boolean(latex.trim()) && /\\|[_^{}=+\-*/<>]|[a-zA-Z]/.test(latex);
}

function mappedScriptText(value: string, map: Record<string, string>): string {
  return Array.from(value)
    .map((character) => map[character] ?? character)
    .join("");
}

export function normalizeLatexSource(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("$$") && trimmed.endsWith("$$")) ||
    (trimmed.startsWith("\\[") && trimmed.endsWith("\\]")) ||
    (trimmed.startsWith("\\(") && trimmed.endsWith("\\)"))
  ) {
    return unwrapLatex(trimmed).latex;
  }
  if (trimmed.startsWith("$") && trimmed.endsWith("$")) return unwrapLatex(trimmed).latex;
  return trimmed;
}

export function renderedMathTextToLatex(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 180) return null;
  if (!/[→←↔⇒≤≥≈≠∑∫√∞∈∉∂∇∏±×÷₀-₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁱⁿ]/.test(trimmed)) {
    return null;
  }
  const proseWords = trimmed.match(/[A-Za-z]{3,}/g) ?? [];
  if (proseWords.length) return null;

  const subscriptPattern = new RegExp(`([A-Za-z0-9\\]\\)])([${subscriptCharacters}]+)`, "g");
  const superscriptPattern = new RegExp(`([A-Za-z0-9\\]\\)])([${superscriptCharacters}]+)`, "g");
  const latex = trimmed
    .replace(subscriptPattern, (_, base: string, script: string) => `${base}_{${mappedScriptText(script, subscriptMap)}}`)
    .replace(superscriptPattern, (_, base: string, script: string) => `${base}^{${mappedScriptText(script, superscriptMap)}}`)
    .replaceAll("→", "\\to ")
    .replaceAll("←", "\\leftarrow ")
    .replaceAll("↔", "\\leftrightarrow ")
    .replaceAll("⇒", "\\Rightarrow ")
    .replaceAll("≤", "\\le ")
    .replaceAll("≥", "\\ge ")
    .replaceAll("≈", "\\approx ")
    .replaceAll("≠", "\\ne ")
    .replaceAll("∑", "\\sum ")
    .replaceAll("∫", "\\int ")
    .replaceAll("√", "\\sqrt ")
    .replaceAll("∞", "\\infty ")
    .replaceAll("∈", "\\in ")
    .replaceAll("∉", "\\notin ")
    .replaceAll("∂", "\\partial ")
    .replaceAll("∇", "\\nabla ")
    .replaceAll("∏", "\\prod ")
    .replaceAll("±", "\\pm ")
    .replaceAll("×", "\\times ")
    .replaceAll("÷", "\\div ")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s+/g, " ")
    .trim();

  return looksLikeLatex(latex) ? latex : null;
}

export function splitLatexSegments(text: string): LatexSegment[] {
  const segments: LatexSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(latexTokenPattern)) {
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: "text", value: text.slice(lastIndex, index) });
    const { latex, display } = unwrapLatex(raw);
    if (looksLikeLatex(latex)) {
      segments.push({ type: "math", latex, display, raw });
    } else {
      segments.push({ type: "text", value: raw });
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < text.length) segments.push({ type: "text", value: text.slice(lastIndex) });
  return segments.length ? segments : [{ type: "text", value: text }];
}

export function containsLatexMath(text: string): boolean {
  return splitLatexSegments(text).some((segment) => segment.type === "math");
}

export function extractDisplayLatex(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(?:\$\$([\s\S]+)\$\$|\\\[([\s\S]+)\\\])$/);
  const latex = normalizeLatexSource(match?.[1] ?? match?.[2] ?? "");
  return latex && looksLikeLatex(latex) ? latex : null;
}

export function renderLatexToHtml(latex: string, displayMode = false): string {
  return katex.renderToString(latex, {
    displayMode,
    output: "html",
    strict: "ignore",
    throwOnError: false,
    trust: false
  });
}

export function latexTextToHtml(text: string): string {
  return splitLatexSegments(text)
    .map((segment) => {
      if (segment.type === "text") return escapeHtml(segment.value).replace(/\n/g, "<br>");
      const className = segment.display ? "math-display-inline" : "math-inline";
      return `<span data-type="inline-math" data-latex="${escapeAttribute(segment.latex)}" data-display="${String(segment.display)}" class="${className}"></span>`;
    })
    .join("");
}

export function latexTextToBlocks(text: string): PasteBlock[] {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return chunks.map((chunk) => {
    const displayLatex = extractDisplayLatex(chunk);
    if (displayLatex) {
      return {
        type: "math",
        content: [richText(displayLatex)],
        props: { latex: displayLatex, caption: "" }
      };
    }
    const renderedLatex = renderedMathTextToLatex(chunk);
    if (renderedLatex) {
      return {
        type: "math",
        content: [richText(renderedLatex)],
        props: { latex: renderedLatex, caption: "" }
      };
    }
    return {
      type: "paragraph",
      content: [richText(chunk)],
      props: { html: `<p>${latexTextToHtml(chunk)}</p>` }
    };
  });
}
