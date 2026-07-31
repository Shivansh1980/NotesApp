import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "div",
      "section",
      "article",
      "main",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "span",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "h1",
      "h2",
      "h3",
      "hr",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td"
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "colspan", "rowspan", "class", "data-type", "data-latex", "data-display"],
    ALLOW_DATA_ATTR: true
  });
}
