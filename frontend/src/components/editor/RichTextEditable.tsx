import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";

import type { Block, BlockUpdate } from "../../types/block.types";
import { blockText, richText } from "../../utils/blockUtils";
import { shouldSyncEditorContent } from "../../utils/editorSync";
import { InlineMath } from "./InlineMathExtension";

type RichTextEditableProps = {
  block: Block;
  className?: string;
  onChange: (block: Block, update: BlockUpdate) => void;
  onKeyDown: (event: React.KeyboardEvent, block: Block) => void;
  onPaste: (event: React.ClipboardEvent, block: Block) => void;
  onFocus: (blockId: string) => void;
  onTextChange: (block: Block, text: string) => void;
  readOnly?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function RichTextEditable({
  block,
  className,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onTextChange,
  readOnly = false
}: RichTextEditableProps) {
  const blockRef = useRef(block);
  const handlersRef = useRef({ onChange, onFocus, onTextChange });
  const lastBlockIdRef = useRef(block.id);
  const readyRef = useRef(false);
  const syncingRef = useRef(false);
  const initialContent = useMemo(() => {
    const html = block.props.html;
    if (typeof html === "string" && html.trim()) return html;
    return `<p>${escapeHtml(blockText(block))}</p>`;
  }, [block.id]);

  useEffect(() => {
    blockRef.current = block;
    handlersRef.current = { onChange, onFocus, onTextChange };
  }, [block, onChange, onFocus, onTextChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "" }),
      InlineMath
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: "rich-text-surface"
      }
    },
    onUpdate({ editor }) {
      if (!readyRef.current || syncingRef.current || !editor.isFocused) return;
      const currentBlock = blockRef.current;
      const handlers = handlersRef.current;
      const text = editor.getText();
      handlers.onTextChange(currentBlock, text);
      handlers.onChange(currentBlock, {
        content: text ? [richText(text)] : [],
        props: { ...currentBlock.props, html: editor.getHTML() }
      });
    },
    onFocus() {
      handlersRef.current.onFocus(blockRef.current.id);
    }
  });

  useEffect(() => {
    if (!editor) return;
    readyRef.current = true;
    return () => {
      readyRef.current = false;
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const html = typeof block.props.html === "string" ? block.props.html : `<p>${escapeHtml(blockText(block))}</p>`;
    const blockIdChanged = lastBlockIdRef.current !== block.id;
    if (shouldSyncEditorContent({ blockIdChanged, currentHtml: editor.getHTML(), incomingHtml: html })) {
      syncingRef.current = true;
      try {
        editor.commands.setContent(html, false);
      } finally {
        syncingRef.current = false;
      }
    }
    lastBlockIdRef.current = block.id;
  }, [block.content, block.id, block.props.html, editor]);

  return (
    <div
      className={className}
      onKeyDownCapture={(event) => onKeyDown(event, block)}
      onPasteCapture={(event) => onPaste(event, block)}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
