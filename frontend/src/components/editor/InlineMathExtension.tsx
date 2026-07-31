import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

import { renderLatexToHtml } from "../../utils/mathUtils";

function InlineMathView({ node }: NodeViewProps) {
  const latex = String(node.attrs.latex ?? "");
  const display = node.attrs.display === true || node.attrs.display === "true";
  return (
    <NodeViewWrapper
      as="span"
      className={display ? "math-display-inline" : "math-inline"}
      data-type="inline-math"
      data-latex={latex}
      data-display={String(display)}
      contentEditable={false}
      dangerouslySetInnerHTML={{ __html: renderLatexToHtml(latex, display) }}
    />
  );
}

export const InlineMath = Node.create({
  name: "inlineMath",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-latex") ?? ""
      },
      display: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-display") === "true"
      }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="inline-math"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = String(HTMLAttributes.latex ?? "");
    const display = HTMLAttributes.display === true || HTMLAttributes.display === "true";
    return [
      "span",
      mergeAttributes({
        "data-type": "inline-math",
        "data-latex": latex,
        "data-display": String(display),
        class: display ? "math-display-inline" : "math-inline"
      })
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  }
});
