export type ExportFormat = "pdf" | "html" | "word" | "markdown" | "plain" | "json";

type ExportSnapshot = {
  title: string;
  html: string;
  text: string;
  blocks: Array<{ type: string; text: string }>;
};

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled"
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getTitle(): string {
  const titleInput = document.querySelector<HTMLInputElement>(".page-title-input");
  return titleInput?.value.trim() || "Untitled";
}

function cleanEditorClone(): HTMLElement {
  const editor = document.querySelector<HTMLElement>(".editor-page");
  if (!editor) throw new Error("No page is open to export");
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".page-icon-input,.save-status,.block-actions,.code-toolbar,.slash-menu,.floating-toolbar").forEach((node) => {
    node.remove();
  });
  clone.querySelectorAll("textarea").forEach((textarea) => {
    textarea.remove();
  });
  clone.querySelectorAll("input").forEach((input) => {
    const replacement = input.classList.contains("page-title-input") ? document.createElement("h1") : document.createElement("span");
    replacement.textContent = input.value;
    replacement.className = input.className;
    input.replaceWith(replacement);
  });
  return clone;
}

export function createExportSnapshot(): ExportSnapshot {
  const clone = cleanEditorClone();
  const blocks = Array.from(clone.querySelectorAll<HTMLElement>(".block-row")).map((row) => {
    const type = Array.from(row.classList)
      .find((item) => item.startsWith("block-") && item !== "block-row")
      ?.replace("block-", "") ?? "paragraph";
    return { type, text: (row.innerText ?? row.textContent ?? "").trim() };
  });
  return {
    title: getTitle(),
    html: clone.outerHTML,
    text: (clone.innerText ?? clone.textContent ?? "").trim(),
    blocks
  };
}

function htmlDocument(snapshot: ExportSnapshot): string {
  const styles = Array.from(document.querySelectorAll('style,link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(snapshot.title)}</title>
  ${styles}
  <style>
    body { margin: 0; background: #0f0f0f; color: #f1f1f1; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
    .editor-page { margin: 0 auto; }
  </style>
</head>
<body>${snapshot.html}</body>
</html>`;
}

function markdown(snapshot: ExportSnapshot): string {
  const title = `# ${snapshot.title}`;
  const body = snapshot.blocks
    .map((block) => {
      if (block.type === "divider") return "---";
      if (block.type === "heading_1") return `# ${block.text}`;
      if (block.type === "heading_2") return `## ${block.text}`;
      if (block.type === "heading_3") return `### ${block.text}`;
      if (block.type === "code") return `\`\`\`\n${block.text}\n\`\`\``;
      if (block.type === "math") return `$$\n${block.text}\n$$`;
      return block.text;
    })
    .filter(Boolean)
    .join("\n\n");
  return `${title}\n\n${body}`.trim();
}

export function copyCurrentPageContents(): Promise<void> {
  const snapshot = createExportSnapshot();
  const html = htmlDocument(snapshot);
  if ("ClipboardItem" in window && navigator.clipboard.write) {
    return navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([snapshot.text], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      })
    ]);
  }
  return navigator.clipboard.writeText(snapshot.text);
}

export function exportCurrentPage(format: ExportFormat): void {
  const snapshot = createExportSnapshot();
  const name = slugify(snapshot.title);
  if (format === "pdf") {
    document.body.classList.add("print-page-only");
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove("print-page-only"), 500);
    }, 50);
    return;
  }
  if (format === "html") download(`${name}.html`, htmlDocument(snapshot), "text/html;charset=utf-8");
  if (format === "word") download(`${name}.doc`, htmlDocument(snapshot), "application/msword;charset=utf-8");
  if (format === "markdown") download(`${name}.md`, markdown(snapshot), "text/markdown;charset=utf-8");
  if (format === "plain") download(`${name}.txt`, snapshot.text, "text/plain;charset=utf-8");
  if (format === "json") download(`${name}.json`, JSON.stringify(snapshot, null, 2), "application/json;charset=utf-8");
}
