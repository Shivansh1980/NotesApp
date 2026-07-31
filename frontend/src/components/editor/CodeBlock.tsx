import { Check, ChevronDown, Clipboard, MoreHorizontal, WrapText } from "lucide-react";
import { useMemo, useState } from "react";

import { IconButton } from "../common/IconButton";
import type { Block, BlockUpdate } from "../../types/block.types";
import { codeLanguages, detectCodeLanguage, getCodeBlockRows, highlightCode, languageLabel } from "../../utils/codeUtils";

type CodeBlockProps = {
  block: Block;
  onChange: (block: Block, update: BlockUpdate) => void;
  onKeyDown: (event: React.KeyboardEvent, block: Block) => void;
  onFocus: (blockId: string) => void;
  onOpenMenu?: (event: React.MouseEvent) => void;
  readOnly?: boolean;
};

export function CodeBlock({ block, onChange, onKeyDown, onFocus, onOpenMenu, readOnly = false }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = String(block.props.code ?? "");
  const language = String(block.props.language ?? "auto");
  const detectedLanguage = useMemo(() => detectCodeLanguage(code), [code]);
  const resolvedLanguage = language === "auto" ? detectedLanguage : language;
  const highlightedCode = useMemo(() => highlightCode(code, language), [code, language]);
  const wrap = Boolean(block.props.wrap);
  const rows = getCodeBlockRows(code);

  const patchProps = (props: Record<string, unknown>) => {
    onChange(block, { props: { ...block.props, ...props } });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1100);
  };

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <label className="code-language-select">
          <select disabled={readOnly} value={language} onChange={(event) => patchProps({ language: event.target.value })}>
            {codeLanguages.map((item) => (
              <option key={item} value={item}>
                {item === "auto" ? `Auto (${languageLabel(detectedLanguage)})` : languageLabel(item)}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <span className="code-language-chip">{languageLabel(resolvedLanguage)}</span>
        <IconButton disabled={readOnly} label="Toggle wrap" active={wrap} onClick={() => patchProps({ wrap: !wrap })}>
          <WrapText size={15} />
        </IconButton>
        <IconButton label="Copy code" onClick={copy}>
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
        </IconButton>
        {onOpenMenu && !readOnly ? (
          <IconButton label="More block actions" onClick={onOpenMenu}>
            <MoreHorizontal size={16} />
          </IconButton>
        ) : null}
      </div>
      <div className={`code-input-shell ${wrap ? "wrap" : ""}`} style={{ minHeight: `${rows * 21 + 32}px` }}>
        <pre className="code-highlight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        <textarea
          className={wrap ? "wrap" : ""}
          spellCheck={false}
          readOnly={readOnly}
          value={code}
          onFocus={() => onFocus(block.id)}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              const target = event.currentTarget;
              const start = target.selectionStart;
              const end = target.selectionEnd;
              const next = `${code.slice(0, start)}  ${code.slice(end)}`;
              patchProps({ code: next });
              window.requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
              return;
            }
            onKeyDown(event, block);
          }}
          onChange={(event) => patchProps({ code: event.target.value })}
        />
      </div>
      {block.props.caption ? <div className="code-caption">{String(block.props.caption)}</div> : null}
    </div>
  );
}
