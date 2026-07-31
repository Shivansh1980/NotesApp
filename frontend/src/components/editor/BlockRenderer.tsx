import {
  ArrowDown,
  ArrowUp,
  Captions,
  ChevronRight,
  CheckSquare,
  Code2,
  CornerDownRight,
  CornerUpRight,
  Copy,
  Clipboard,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Languages,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  MoreHorizontal,
  Pilcrow,
  Plus,
  Quote,
  Search,
  Trash2,
  Triangle,
  Square,
  Type,
  WrapText
} from "lucide-react";
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "../common/IconButton";
import { BookmarkBlock, FileBlock, ImageBlock } from "./MediaBlocks";
import { CodeBlock } from "./CodeBlock";
import { RichTextEditable } from "./RichTextEditable";
import { TableBlock } from "./TableBlock";
import { MathBlock } from "./MathBlock";
import type { Block, BlockUpdate } from "../../types/block.types";
import type { BlockType } from "../../types/block.types";
import { blockLabel, blockText } from "../../utils/blockUtils";
import { codeLanguages, languageLabel, type CodeLanguage } from "../../utils/codeUtils";

type BlockRendererProps = {
  block: Block;
  selected: boolean;
  onChange: (block: Block, update: BlockUpdate) => void;
  onAddAfter: (block: Block) => void;
  onDelete: (block: Block) => void;
  onDuplicate: (block: Block) => void;
  onCopy: (block: Block) => void;
  onCopyLink: (block: Block) => void;
  onComment: (block: Block) => void;
  onMove: (block: Block, direction: -1 | 1) => void;
  onTransform: (block: Block, type: BlockType) => void;
  onKeyDown: (event: React.KeyboardEvent, block: Block) => void;
  onPaste: (event: React.ClipboardEvent, block: Block) => void;
  onFocus: (blockId: string) => void;
  onTextChange: (block: Block, text: string) => void;
  onSelect: (block: Block, multi: boolean) => void;
  readOnly?: boolean;
};

export function BlockRenderer(props: BlockRendererProps) {
  const { block, selected, onChange, onAddAfter, onDelete, onDuplicate, onCopy, onCopyLink, onComment, onMove, onSelect } =
    props;
  const readOnly = Boolean(props.readOnly);
  const indent = Number(block.props.indent ?? 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !menuPanelRef.current?.contains(target)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    const updatePosition = () => {
      const row = menuRef.current;
      const panel = menuPanelRef.current;
      if (!row || !panel) return;

      const gap = 8;
      const margin = 12;
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const rowRect = row.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const panelWidth = Math.min(panelRect.width || 360, viewportWidth - margin * 2);
      const panelHeight = Math.min(panelRect.height || 480, viewportHeight - margin * 2);
      const anchor = menuAnchor ?? {
        x: Math.min(rowRect.right, viewportWidth - margin),
        y: rowRect.top
      };

      let left = anchor.x + gap;
      if (left + panelWidth > viewportWidth - margin) {
        left = anchor.x - panelWidth - gap;
      }
      left = Math.max(margin, Math.min(left, viewportWidth - margin - panelWidth));

      let top = anchor.y;
      if (top + panelHeight > viewportHeight - margin) {
        top = anchor.y - panelHeight + gap;
      }
      top = Math.max(margin, Math.min(top, viewportHeight - margin - panelHeight));

      setMenuStyle({
        position: "fixed",
        top,
        left,
        right: "auto",
        maxWidth: `calc(100vw - ${margin * 2}px)`
      });
    };

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuAnchor, menuOpen]);

  const openMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(block, false);
    setMenuAnchor({ x: event.clientX, y: event.clientY });
    setMenuStyle({
      position: "fixed",
      top: event.clientY,
      left: event.clientX,
      right: "auto"
    });
    setMenuOpen(true);
  };

  return (
    <div
      className={`block-row block-${block.type} ${selected ? "selected" : ""} ${menuOpen ? "menu-open" : ""}`}
      style={{ marginLeft: indent * 22 }}
      data-block-id={block.id}
      id={`block-${block.id}`}
      ref={menuRef}
    >
      {!readOnly ? <div className="block-control-rail">
        <IconButton label="Add block below" className="block-gutter-button" onClick={() => onAddAfter(block)}>
          <Plus size={20} strokeWidth={1.8} />
        </IconButton>
        <IconButton
          label="Block actions"
          className="block-gutter-button block-handle"
          onMouseDown={(event) => onSelect(block, event.shiftKey || event.metaKey || event.ctrlKey)}
          onClick={openMenu}
        >
          <GripVertical size={20} strokeWidth={2.1} />
        </IconButton>
      </div> : null}
      <div className="block-content">{renderBlock({ ...props, openMenu })}</div>
      {menuOpen ? createPortal(
        <BlockActionMenu
          ref={menuPanelRef}
          style={menuStyle}
          block={block}
          onChange={onChange}
          onClose={() => setMenuOpen(false)}
          onCopy={() => onCopy(block)}
          onCopyLink={() => onCopyLink(block)}
          onDuplicate={() => onDuplicate(block)}
          onMove={onMove}
          onDelete={() => onDelete(block)}
          onComment={() => onComment(block)}
          onTransform={props.onTransform}
        />,
        document.body
      ) : null}
    </div>
  );
}

type RenderBlockProps = BlockRendererProps & {
  openMenu: (event: React.MouseEvent) => void;
};

const BlockActionMenu = forwardRef<HTMLDivElement, {
  block: Block;
  style?: CSSProperties;
  onChange: (block: Block, update: BlockUpdate) => void;
  onClose: () => void;
  onCopy: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onMove: (block: Block, direction: -1 | 1) => void;
  onDelete: () => void;
  onComment: () => void;
  onTransform: (block: Block, type: BlockType) => void;
}>(function BlockActionMenu({
  block,
  style,
  onChange,
  onClose,
  onCopy,
  onCopyLink,
  onDuplicate,
  onMove,
  onDelete,
  onComment,
  onTransform
}, ref) {
  const [transformOpen, setTransformOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [query, setQuery] = useState("");
  const isCode = block.type === "code";
  const wrap = Boolean(block.props.wrap);
  const selectedLanguage = String(block.props.language ?? "auto");
  const matches = (label: string) => label.toLowerCase().includes(query.trim().toLowerCase());
  const transformOptions: Array<{ type: BlockType; label: string; icon: JSX.Element }> = [
    { type: "paragraph", label: "Text", icon: <Pilcrow size={18} /> },
    { type: "heading_1", label: "Heading 1", icon: <Heading1 size={18} /> },
    { type: "heading_2", label: "Heading 2", icon: <Heading2 size={18} /> },
    { type: "heading_3", label: "Heading 3", icon: <Heading3 size={18} /> },
    { type: "todo", label: "To-do", icon: <CheckSquare size={18} /> },
    { type: "bulleted_list", label: "Bullet list", icon: <List size={18} /> },
    { type: "numbered_list", label: "Numbered list", icon: <ListOrdered size={18} /> },
    { type: "quote", label: "Quote", icon: <Quote size={18} /> },
    { type: "code", label: "Code", icon: <Code2 size={18} /> }
  ];
  const codeMenuLanguages: CodeLanguage[] = [
    "auto",
    "plain text",
    "javascript",
    "typescript",
    "python",
    "csharp",
    "java",
    "cpp",
    "json",
    "sql"
  ];

  const run = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div ref={ref} className="block-context-menu" style={style} onMouseDown={(event) => event.stopPropagation()}>
      <label className="block-menu-search">
        <Search size={15} />
        <input value={query} placeholder="Search actions..." onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="block-menu-eyebrow">{blockLabel(block.type)}</div>
      {matches("Turn into") ? <button type="button" onClick={() => setTransformOpen((value) => !value)}>
        <Type size={18} />
        Turn into
        <ChevronRight size={15} className="menu-arrow" />
      </button> : null}
      {transformOpen ? (
        <div className="block-menu-submenu">
          {transformOptions.map((option) => (
            <button
              key={option.type}
              className={block.type === option.type ? "selected" : ""}
              type="button"
              onClick={() => run(() => onTransform(block, option.type))}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {isCode ? (
        <>
          <button
            type="button"
            onClick={() =>
              run(() => {
                const caption = window.prompt("Caption", String(block.props.caption ?? ""));
                if (caption !== null) onChange(block, { props: { ...block.props, caption } });
              })
            }
          >
            <Captions size={18} />
            Caption
            <kbd>Ctrl+Alt+M</kbd>
          </button>
          <button type="button" onClick={() => run(() => void navigator.clipboard.writeText(blockText(block)))}>
            <Code2 size={18} />
            Copy code
          </button>
          <button type="button" onClick={() => onChange(block, { props: { ...block.props, wrap: !wrap } })}>
            <CornerDownRight size={18} />
            Wrap code
            <span className={`menu-switch ${wrap ? "on" : ""}`} />
          </button>
          <button type="button" onClick={() => setLanguageOpen((value) => !value)}>
            <Languages size={18} />
            Language
            <ChevronRight size={15} className="menu-arrow" />
          </button>
          {languageOpen ? (
            <div className="block-menu-submenu">
              {codeMenuLanguages.filter((language) => codeLanguages.includes(language)).map((language) => (
                <button
                  key={language}
                  className={selectedLanguage === language ? "selected" : ""}
                  type="button"
                  onClick={() => run(() => onChange(block, { props: { ...block.props, language } }))}
                >
                  <Code2 size={16} />
                  {language === "auto" ? "Auto detect" : languageLabel(language)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <div className="menu-divider" />
      {matches("Copy link to block") ? <button type="button" onClick={() => run(onCopyLink)}>
        <Link2 size={18} />
        Copy link to block
        <kbd>Alt+Shift+L</kbd>
      </button> : null}
      {matches("Copy block") ? <button type="button" onClick={() => run(onCopy)}>
        <Clipboard size={18} />
        Copy block
      </button> : null}
      {matches("Duplicate") ? <button type="button" onClick={() => run(onDuplicate)}>
        <Copy size={18} />
        Duplicate
        <kbd>Ctrl+D</kbd>
      </button> : null}
      {matches("Move up") ? <button type="button" onClick={() => run(() => onMove(block, -1))}>
        <ArrowUp size={18} />
        Move up
      </button> : null}
      {matches("Move down") ? <button type="button" onClick={() => run(() => onMove(block, 1))}>
        <ArrowDown size={18} />
        Move down
      </button> : null}
      {matches("Delete") ? <button type="button" className="danger" onClick={() => run(onDelete)}>
        <Trash2 size={18} />
        Delete
        <kbd>Del</kbd>
      </button> : null}
      <div className="menu-divider" />
      {matches("Comment") ? <button type="button" onClick={() => run(onComment)}>
        <MessageSquare size={18} />
        Comment
        <kbd>Ctrl+Shift+M</kbd>
      </button> : null}
    </div>
  );
});

function renderBlock(props: RenderBlockProps) {
  const { block, onChange } = props;
  const readOnly = Boolean(props.readOnly);
  if (block.type === "divider") return <div className="divider-block" tabIndex={0} />;
  if (block.type === "math") return <MathBlock {...props} />;
  if (block.type === "code") return <CodeBlock {...props} onOpenMenu={props.openMenu} />;
  if (block.type === "image") return <ImageBlock block={block} onChange={onChange} readOnly={readOnly} />;
  if (block.type === "file") return <FileBlock block={block} onChange={onChange} />;
  if (block.type === "bookmark") return <BookmarkBlock block={block} onChange={onChange} readOnly={readOnly} />;
  if (block.type === "table") return <TableBlock block={block} onChange={onChange} readOnly={readOnly} />;
  if (block.type === "todo") {
    return (
      <div className="todo-block">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={Boolean(block.props.checked)}
          onChange={(event) => onChange(block, { props: { ...block.props, checked: event.target.checked } })}
        />
        <RichTextEditable {...props} className={block.props.checked ? "checked" : ""} />
      </div>
    );
  }
  if (block.type === "toggle") {
    const open = block.props.open !== false;
    return (
      <div className="toggle-block">
        <button
          type="button"
          className="toggle-button"
          disabled={readOnly}
          onClick={() => onChange(block, { props: { ...block.props, open: !open } })}
        >
          <Triangle size={13} className={open ? "open" : ""} />
        </button>
        <RichTextEditable {...props} />
      </div>
    );
  }
  if (block.type === "bulleted_list" || block.type === "numbered_list") {
    return (
      <div className="list-block">
        <span className="list-marker">{block.type === "bulleted_list" ? <List size={15} /> : <ListOrdered size={15} />}</span>
        <RichTextEditable {...props} />
      </div>
    );
  }
  if (block.type === "callout") {
    return (
      <div className="callout-block">
        <Square size={15} />
        <RichTextEditable {...props} />
      </div>
    );
  }
  return <RichTextEditable {...props} readOnly={readOnly} />;
}
