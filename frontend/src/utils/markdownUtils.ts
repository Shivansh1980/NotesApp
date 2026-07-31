import type { BlockType, PasteBlock } from "../types/block.types";
import { emptyPropsForType, richText } from "./blockUtils";

const shortcutMap: Record<string, BlockType> = {
  "#": "heading_1",
  "##": "heading_2",
  "###": "heading_3",
  "-": "bulleted_list",
  "*": "bulleted_list",
  "1.": "numbered_list",
  "[]": "todo",
  "[ ]": "todo",
  ">": "quote",
  "::": "callout",
  ">>": "toggle"
};

export function markdownShortcutFor(text: string): { type: BlockType; checked?: boolean } | null {
  const trimmed = text.trim();
  if (trimmed === "---") return { type: "divider" };
  if (trimmed === "```") return { type: "code" };
  if (trimmed === "[x]") return { type: "todo", checked: true };
  const type = shortcutMap[trimmed];
  return type ? { type } : null;
}

export function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)(#{1,3}\s|[-*]\s|1\.\s|>\s|```|\[x?\]\s|\[ \]\s)/.test(text.trim());
}

export function markdownToBlocks(markdown: string): PasteBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: PasteBlock[] = [];
  let codeBuffer: string[] | null = null;
  let codeLanguage = "plain text";

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (codeBuffer) {
        blocks.push({
          type: "code",
          content: [],
          props: { language: codeLanguage, code: codeBuffer.join("\n"), wrap: false, caption: "" }
        });
        codeBuffer = null;
        codeLanguage = "plain text";
      } else {
        codeBuffer = [];
        codeLanguage = line.slice(3).trim() || "plain text";
      }
      continue;
    }
    if (codeBuffer) {
      codeBuffer.push(line);
      continue;
    }
    if (!line.trim()) continue;
    const match = line.match(/^(#{1,3}|[-*]|1\.|>|\[ \]|\[x\]|>>|::)\s+(.*)$/i);
    if (!match) {
      blocks.push({ type: "paragraph", content: [richText(line)], props: {} });
      continue;
    }
    const [, marker, value] = match;
    const shortcut = markdownShortcutFor(marker.toLowerCase());
    const type = shortcut?.type ?? "paragraph";
    blocks.push({
      type,
      content: type === "divider" ? [] : [richText(value)],
      props: { ...emptyPropsForType(type), checked: marker.toLowerCase() === "[x]" }
    });
  }

  if (codeBuffer) {
    blocks.push({
      type: "code",
      content: [],
      props: { language: codeLanguage, code: codeBuffer.join("\n"), wrap: false, caption: "" }
    });
  }
  return blocks.length ? blocks : [{ type: "paragraph", content: [richText(markdown)], props: {} }];
}
