import { useEffect, useRef, useState } from "react";

import type { Block, BlockUpdate } from "../../types/block.types";
import { richText } from "../../utils/blockUtils";
import { renderLatexToHtml } from "../../utils/mathUtils";

type MathBlockProps = {
  block: Block;
  onChange: (block: Block, update: BlockUpdate) => void;
  onKeyDown: (event: React.KeyboardEvent, block: Block) => void;
  onFocus: (blockId: string) => void;
  readOnly?: boolean;
};

export function MathBlock({ block, onChange, onKeyDown, onFocus, readOnly = false }: MathBlockProps) {
  const latex = String(block.props.latex ?? "");
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    window.requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      const end = target.value.length;
      target.setSelectionRange(end, end);
    });
  }, [editing]);

  const patchLatex = (nextLatex: string) => {
    onChange(block, {
      content: nextLatex ? [richText(nextLatex)] : [],
      props: { ...block.props, latex: nextLatex }
    });
  };

  return (
    <div
      className={`math-block ${editing ? "editing" : ""}`}
      tabIndex={0}
      onMouseDown={() => onFocus(block.id)}
      onFocus={() => onFocus(block.id)}
      onClick={() => {
        if (!readOnly && !editing) setEditing(true);
      }}
      onKeyDown={(event) => {
        if (!readOnly && !editing && (event.key === "Enter" || event.key === "F2")) {
          event.preventDefault();
          setEditing(true);
          return;
        }
        onKeyDown(event, block);
      }}
    >
      {editing ? (
        <textarea
          ref={textareaRef}
          className="math-source-editor"
          aria-label="Equation"
          spellCheck={false}
          value={latex}
          placeholder="Type LaTeX..."
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setEditing(false);
              return;
            }
            onKeyDown(event, block);
          }}
          onChange={(event) => patchLatex(event.target.value)}
        />
      ) : (
        <div
          className="math-render"
          dangerouslySetInnerHTML={{
            __html: latex.trim() ? renderLatexToHtml(latex, true) : '<span class="math-empty">Equation</span>'
          }}
        />
      )}
    </div>
  );
}
