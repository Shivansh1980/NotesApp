export const codeLanguages = [
  "auto",
  "plain text",
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "swift",
  "kotlin",
  "html",
  "css",
  "scss",
  "json",
  "yaml",
  "xml",
  "sql",
  "bash",
  "markdown"
] as const;

export type CodeLanguage = (typeof codeLanguages)[number];

const languageLabels: Record<string, string> = {
  auto: "Auto detect",
  "plain text": "Plain text",
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  sql: "SQL",
  bash: "Bash",
  markdown: "Markdown"
};

export function languageLabel(language: string): string {
  return languageLabels[language] ?? language;
}

export function detectCodeLanguage(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "plain text";
  if (/^\s*[{[][\s\S]*[}\]]\s*$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // keep checking other languages
    }
  }
  if (/^\s*<([a-z][\w-]*)(\s|>|\/>)[\s\S]*<\/\1>/i.test(trimmed) || /<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return "html";
  }
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|WITH)\b/i.test(trimmed)) return "sql";
  if (/^\s*(from|import)\s+\w+|^\s*def\s+\w+\(|^\s*class\s+\w+[:(]/m.test(trimmed)) return "python";
  if (/\b(interface|type)\s+\w+\s*=|:\s*(string|number|boolean)\b|<[A-Z][\w.]*\s*\/?>/.test(trimmed)) {
    return "typescript";
  }
  if (/\b(import|export)\b|=>|console\.log|function\s+\w+\(|\b(const|let|var)\s+\w+/.test(trimmed)) {
    return "javascript";
  }
  if (/^\s*(package\s+main|func\s+\w+\(|fmt\.Print|:=)/m.test(trimmed)) return "go";
  if (/\b(fn|let mut|impl|println!)\b/.test(trimmed)) return "rust";
  if (/^\s*(#include|int\s+main|std::)/m.test(trimmed)) return "cpp";
  if (/^\s*(public\s+class|System\.out\.println|private\s+\w+)/m.test(trimmed)) return "java";
  if (/^\s*(echo|npm|pnpm|yarn|git|cd|ls|mkdir|rm|sudo)\b/m.test(trimmed)) return "bash";
  if (/^\s*[-*]\s+|^#{1,6}\s+/m.test(trimmed)) return "markdown";
  if (/^[\w.-]+\s*:\s*.+$/m.test(trimmed)) return "yaml";
  return "plain text";
}

export function looksLikeSourceCode(text: string): boolean {
  const trimmed = text.trim();
  const lineCount = trimmed.split(/\r?\n/).length;
  if (!trimmed || trimmed.length < 16) return false;
  if (detectCodeLanguage(trimmed) !== "plain text") return true;
  if (lineCount < 3) return false;
  const codeSignals = [
    /[{};]/,
    /^\s{2,}\S/m,
    /^\s*(if|for|while|return|class|def|function|const|let|var)\b/m,
    /=>|==|!=|<=|>=/
  ];
  return codeSignals.filter((pattern) => pattern.test(trimmed)).length >= 2;
}

export function getCodeBlockRows(code: string): number {
  const lineCount = code ? code.split(/\r?\n/).length : 1;
  return Math.min(Math.max(lineCount, 1), 18);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function highlightCode(code: string, language: string): string {
  const resolved = language === "auto" ? detectCodeLanguage(code) : language;
  const html = escapeHtml(code);
  const commonKeywords =
    "import|from|export|const|let|var|function|return|if|else|for|while|class|interface|type|def|async|await|public|private|static|new|try|catch|finally|switch|case|break|continue|fn|impl|struct|package|func";
  const sqlKeywords =
    "SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|INSERT|UPDATE|DELETE|CREATE|ALTER|GROUP|ORDER|BY|LIMIT|AND|OR|AS|ON";
  const keywordPattern =
    resolved === "sql"
      ? sqlKeywords
      : ["html", "xml"].includes(resolved)
        ? "&lt;\\/?[\\w-]+|\\/?&gt;"
        : ["css", "scss"].includes(resolved)
          ? "[.#]?[\\w-]+(?=\\s*[{:,])"
          : commonKeywords;
  const tokenPattern = new RegExp(
    `(\\/\\/.*|#.*$|\\/\\*[\\s\\S]*?\\*\\/)|(&quot;.*?&quot;|'.*?'|\`.*?\`)|\\b(true|false|null|undefined|None|nil)\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b(${keywordPattern})\\b|(${keywordPattern})`,
    "gim"
  );
  return (
    html.replace(tokenPattern, (match) => {
      if (/^(\/\/|#|\/\*)/.test(match)) return `<span class="tok-comment">${match}</span>`;
      if (/^(&quot;|'|`)/.test(match)) return `<span class="tok-string">${match}</span>`;
      if (/^\d/.test(match)) return `<span class="tok-number">${match}</span>`;
      if (/^(true|false|null|undefined|None|nil)$/i.test(match)) return `<span class="tok-literal">${match}</span>`;
      return `<span class="tok-keyword">${match}</span>`;
    }) || "&nbsp;"
  );
}
