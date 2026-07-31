import type { PasteBlock } from "../types/block.types";
import { richText } from "./blockUtils";
import { detectCodeLanguage, looksLikeSourceCode } from "./codeUtils";
import { sanitizeHtml } from "./htmlSanitizer";
import { looksLikeMarkdown, markdownToBlocks } from "./markdownUtils";
import {
  containsLatexMath,
  extractDisplayLatex,
  latexTextToBlocks,
  normalizeLatexSource,
  renderedMathTextToLatex
} from "./mathUtils";

const INTERNAL_MIME = "application/x-app-blocks+json";

export function looksLikeUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function looksLikeTable(text: string): boolean {
  const rows = text.trim().split(/\r?\n/);
  return rows.length > 1 && rows.every((row) => row.includes("\t") || row.includes(","));
}

export function looksLikeCode(text: string): boolean {
  return looksLikeSourceCode(text);
}

export function textToTable(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(row.includes("\t") ? "\t" : ",").map((cell) => cell.trim()));
}

export function plainTextToBlocks(text: string): PasteBlock[] {
  const displayLatex = extractDisplayLatex(text);
  if (displayLatex) return [{ type: "math", content: [richText(displayLatex)], props: { latex: displayLatex, caption: "" } }];
  const renderedLatex = renderedMathTextToLatex(text);
  if (renderedLatex) return [{ type: "math", content: [richText(renderedLatex)], props: { latex: renderedLatex, caption: "" } }];
  if (containsLatexMath(text)) return latexTextToBlocks(text);
  if (text.trim() === "---") return [{ type: "divider", content: [], props: {} }];
  if (looksLikeMarkdown(text)) return markdownToBlocks(text);
  if (looksLikeTable(text)) return [{ type: "table", content: [], props: { rows: textToTable(text) } }];
  if (looksLikeCode(text)) {
    const language = detectCodeLanguage(text);
    return [
      {
        type: "code",
        content: [],
        props: { language: language === "plain text" ? "auto" : language, code: text, wrap: false, caption: "" }
      }
    ];
  }
  if (looksLikeUrl(text)) return [{ type: "bookmark", content: [richText(text.trim())], props: { url: text.trim() } }];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const lineLatex = renderedMathTextToLatex(line);
      if (lineLatex) return { type: "math", content: [richText(lineLatex)], props: { latex: lineLatex, caption: "" } };
      return { type: "paragraph", content: [richText(line)], props: {} };
    });
}

function elementClassList(element: Element): string {
  return element.getAttribute("class") ?? "";
}

function mathAnnotationLatex(element: Element): string | null {
  const annotations = Array.from(element.querySelectorAll("annotation"));
  const annotation = annotations.find((item) => {
    const encoding = item.getAttribute("encoding")?.toLowerCase() ?? "";
    return encoding.includes("tex") || encoding.includes("latex");
  });
  return annotation?.textContent?.trim() || null;
}

function latexFromMathElement(element: Element): string | null {
  const directLatex =
    element.getAttribute("data-latex") ??
    element.getAttribute("data-tex") ??
    element.getAttribute("alttext") ??
    mathAnnotationLatex(element);
  if (directLatex?.trim()) return normalizeLatexSource(directLatex);

  if (element.tagName.toLowerCase() === "script" && (element.getAttribute("type") ?? "").toLowerCase().includes("math/tex")) {
    return normalizeLatexSource(element.textContent ?? "");
  }

  const ariaLatex = element.getAttribute("aria-label");
  if (ariaLatex && /\\|[_^{}]/.test(ariaLatex)) return normalizeLatexSource(ariaLatex);
  return renderedMathTextToLatex(element.textContent ?? "");
}

function isDisplayMathElement(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  const className = elementClassList(element);
  const type = element.getAttribute("type")?.toLowerCase() ?? "";
  return (
    element.getAttribute("data-display") === "true" ||
    element.getAttribute("display") === "block" ||
    className.includes("katex-display") ||
    className.includes("math-display") ||
    type.includes("mode=display") ||
    (tag === "math" && element.getAttribute("display") !== "inline")
  );
}

function normalizeClipboardMath(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const selector = [
    'script[type*="math/tex"]',
    '[data-type="inline-math"]',
    "[data-latex]",
    "[data-tex]",
    ".katex-display",
    ".katex",
    "math"
  ].join(",");
  const readableCandidates = Array.from(document.body.querySelectorAll(selector)).filter((element) => latexFromMathElement(element));
  const outermostCandidates = readableCandidates.filter(
    (element) => !readableCandidates.some((other) => other !== element && other.contains(element))
  );

  for (const element of outermostCandidates) {
    if (!element.isConnected) continue;
    const latex = latexFromMathElement(element);
    if (!latex) continue;
    const replacement = document.createElement("span");
    const display = isDisplayMathElement(element);
    replacement.setAttribute("data-type", "inline-math");
    replacement.setAttribute("data-latex", latex);
    replacement.setAttribute("data-display", String(display));
    replacement.setAttribute("class", display ? "math-display-inline" : "math-inline");
    element.replaceWith(replacement);
  }

  return document.body.innerHTML;
}

function textContentWithBreaks(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? "";
  if (node.nodeType === 1) {
    const element = node as Element;
    if (element.tagName.toLowerCase() === "br") return "\n";
    if (element.getAttribute("data-type") === "inline-math") {
      const latex = normalizeLatexSource(element.getAttribute("data-latex") ?? "");
      if (!latex) return "";
      return element.getAttribute("data-display") === "true" ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
    }
  }
  return Array.from(node.childNodes).map(textContentWithBreaks).join("");
}

function isMathMarker(element: Element): boolean {
  return element.getAttribute("data-type") === "inline-math" && Boolean(element.getAttribute("data-latex")?.trim());
}

function isDisplayMathMarker(element: Element): boolean {
  return isMathMarker(element) && element.getAttribute("data-display") === "true";
}

function pushMathMarker(blocks: PasteBlock[], element: Element) {
  const latex = normalizeLatexSource(element.getAttribute("data-latex") ?? "");
  if (!latex) return;
  blocks.push({ type: "math", content: [richText(latex)], props: { latex, caption: "" } });
}

function alignBlocksToPlainTextOrder(blocks: PasteBlock[], _plainText: string): PasteBlock[] {
  // HTML paste already carries DOM order. ChatGPT/KaTeX text/plain often contains
  // accessibility math fragments in a different order, so using it for alignment
  // can move ordinary text blocks after display equations.
  return blocks;
}

export function htmlToBlocks(html: string): PasteBlock[] {
  const parser = new DOMParser();
  const document = parser.parseFromString(sanitizeHtml(normalizeClipboardMath(html)), "text/html");
  const blocks: PasteBlock[] = [];
  const blockTags = new Set(["p", "div", "section", "article", "main", "h1", "h2", "h3", "blockquote", "pre", "ul", "ol", "hr", "img", "table"]);

  const pushText = (type: PasteBlock["type"], text: string, props = {}) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (type === "paragraph" && containsLatexMath(trimmed)) {
      blocks.push(...latexTextToBlocks(trimmed));
      return;
    }
    if (type === "paragraph") {
      const renderedLatex = renderedMathTextToLatex(trimmed);
      if (renderedLatex) {
        blocks.push({ type: "math", content: [richText(renderedLatex)], props: { latex: renderedLatex, caption: "" } });
        return;
      }
    }
    if (type === "paragraph") {
      const lines = trimmed
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 1) {
        lines.forEach((line) => pushText("paragraph", line, props));
        return;
      }
    }
    blocks.push({ type, content: [richText(trimmed)], props });
  };

  const inlineText = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent ?? "";
    if (node.nodeType !== 1) return "";
    const element = node as Element;
    if (element.tagName.toLowerCase() === "br") return "\n";
    if (isMathMarker(element)) {
      const latex = normalizeLatexSource(element.getAttribute("data-latex") ?? "");
      return isDisplayMathMarker(element) ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
    }
    return Array.from(element.childNodes).map(inlineText).join("");
  };

  const pushInlineContainer = (element: Element, type: PasteBlock["type"], props = {}) => {
    let buffer = "";
    const flush = () => {
      pushText(type, buffer, props);
      buffer = "";
    };

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 1 && isDisplayMathMarker(child as Element)) {
        flush();
        pushMathMarker(blocks, child as Element);
        continue;
      }
      buffer += inlineText(child);
    }
    flush();
  };

  const walkContainer = (element: Element) => {
    let buffer = "";
    const flush = () => {
      pushText("paragraph", buffer);
      buffer = "";
    };

    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType !== 1) {
        buffer += inlineText(child);
        continue;
      }
      const childElement = child as Element;
      const tag = childElement.tagName.toLowerCase();
      if (blockTags.has(tag) || isDisplayMathMarker(childElement)) {
        flush();
        walkNode(childElement);
      } else {
        buffer += inlineText(childElement);
      }
    }
    flush();
  };

  const walkNode = (node: Node) => {
    if (node.nodeType === 3) {
      pushText("paragraph", node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (isDisplayMathMarker(element)) {
      pushMathMarker(blocks, element);
      return;
    }
    if (isMathMarker(element)) {
      pushText("paragraph", inlineText(element));
      return;
    }
    const elementNode = element as HTMLElement;
    const tag = elementNode.tagName.toLowerCase();
    if (tag === "h1") pushInlineContainer(elementNode, "heading_1");
    else if (tag === "h2") pushInlineContainer(elementNode, "heading_2");
    else if (tag === "h3") pushInlineContainer(elementNode, "heading_3");
    else if (tag === "blockquote") pushInlineContainer(elementNode, "quote");
    else if (tag === "hr") blocks.push({ type: "divider", content: [], props: {} });
    else if (tag === "pre") {
      const code = textContentWithBreaks(elementNode).trimEnd();
      const language = detectCodeLanguage(code);
      blocks.push({
        type: "code",
        content: [],
        props: { language: language === "plain text" ? "auto" : language, code, wrap: false, caption: "" }
      });
    } else if (tag === "ul" || tag === "ol") {
      Array.from(elementNode.children)
        .filter((item) => item.tagName.toLowerCase() === "li")
        .forEach((item) => pushInlineContainer(item, tag === "ul" ? "bulleted_list" : "numbered_list"));
    } else if (tag === "img") {
      const img = elementNode as HTMLImageElement;
      blocks.push({
        type: "image",
        content: [],
        props: { url: img.src, caption: img.alt ?? "", align: "center" }
      });
    } else if (tag === "table") {
      const rows = Array.from(elementNode.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) => cell.textContent?.trim() ?? "")
      );
      blocks.push({ type: "table", content: [], props: { rows } });
    } else if (tag === "p") {
      pushInlineContainer(elementNode, "paragraph");
    } else {
      walkContainer(elementNode);
    }
  };

  Array.from(document.body.childNodes).forEach(walkNode);
  return blocks.length ? blocks : plainTextToBlocks(textContentWithBreaks(document.body));
}

export async function clipboardToBlocks(
  clipboard: DataTransfer,
  uploadFile?: (file: File) => Promise<{ url: string; fileName: string; fileType: string }>
): Promise<PasteBlock[]> {
  const internal = clipboard.getData(INTERNAL_MIME);
  if (internal) {
    const parsed = JSON.parse(internal) as { type: string; version: number; blocks: PasteBlock[] };
    if (parsed.type === "app-blocks" && parsed.version === 1) return parsed.blocks;
  }

  const files = Array.from(clipboard.files);
  if (files.length && uploadFile) {
    const uploaded = await Promise.all(files.map((file) => uploadFile(file)));
    return uploaded.map((file) => ({
      type: file.fileType.startsWith("image/") ? "image" : "file",
      content: [],
      props: { url: file.url, fileName: file.fileName, caption: "" }
    }));
  }

  const html = clipboard.getData("text/html");
  if (html) {
    const htmlBlocks = htmlToBlocks(html);
    const plainText = clipboard.getData("text/plain");
    return plainText ? alignBlocksToPlainTextOrder(htmlBlocks, plainText) : htmlBlocks;
  }

  const text = clipboard.getData("text/plain");
  if (!text) return [];
  return plainTextToBlocks(text);
}

function blockPlainText(block: PasteBlock): string {
  if (block.type === "divider") return "---";
  if (block.type === "code") return String(block.props?.code ?? "");
  if (block.type === "math") return `$$${String(block.props?.latex ?? (block.content ?? []).map((part) => part.text).join(""))}$$`;
  return (block.content ?? []).map((part) => part.text).join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function blockHtml(block: PasteBlock): string {
  const text = blockPlainText(block);
  if (block.type === "divider") return "<hr>";
  if (block.type === "code") return `<pre><code>${escapeHtml(text)}</code></pre>`;
  if (block.type === "math") return `<p>${escapeHtml(text)}</p>`;
  return `<p>${escapeHtml(text)}</p>`;
}

export function serializeBlocksForClipboard(blocks: PasteBlock[]): Record<string, string> {
  const plain = blocks.map(blockPlainText).join("\n");
  return {
    [INTERNAL_MIME]: JSON.stringify({ type: "app-blocks", version: 1, blocks }),
    "text/plain": plain,
    "text/markdown": blocks.map(blockPlainText).join("\n\n"),
    "text/html": blocks.map(blockHtml).join("")
  };
}

export async function copyBlocksToClipboard(blocks: PasteBlock[]): Promise<void> {
  const serialized = serializeBlocksForClipboard(blocks);
  if ("ClipboardItem" in window && navigator.clipboard.write) {
    const item = new ClipboardItem({
      "text/plain": new Blob([serialized["text/plain"]], { type: "text/plain" }),
      "text/html": new Blob([serialized["text/html"]], { type: "text/html" })
    });
    await navigator.clipboard.write([item]);
    return;
  }
  await navigator.clipboard.writeText(serialized["text/markdown"]);
}
