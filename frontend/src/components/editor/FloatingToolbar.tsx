import { Bold, Code2, Italic, Link, Strikethrough, Underline } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "../common/IconButton";

type ToolbarPosition = {
  left: number;
  top: number;
};

function selectionInsideEditor(selection: Selection | null): selection is Selection {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const anchor = selection.anchorNode;
  const editor = document.querySelector(".block-editor");
  return Boolean(anchor && editor?.contains(anchor));
}

function wrapSelection(tagName: string, className?: string) {
  const selection = window.getSelection();
  if (!selectionInsideEditor(selection)) return;
  const range = selection.getRangeAt(0);
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.append(range.extractContents());
  range.insertNode(element);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(element);
  selection.addRange(nextRange);
}

export function FloatingToolbar() {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);

  useEffect(() => {
    const update = () => {
      const selection = window.getSelection();
      if (!selectionInsideEditor(selection)) {
        setPosition(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setPosition({
        left: Math.max(12, rect.left + rect.width / 2),
        top: Math.max(12, rect.top - 12)
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("keyup", update);
    window.addEventListener("mouseup", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("keyup", update);
      window.removeEventListener("mouseup", update);
    };
  }, []);

  const run = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  if (!position) return null;

  return (
    <div className="floating-toolbar" style={{ left: position.left, top: position.top }}>
      <IconButton label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => run("bold")}>
        <Bold size={17} />
      </IconButton>
      <IconButton label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => run("italic")}>
        <Italic size={17} />
      </IconButton>
      <IconButton label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => run("underline")}>
        <Underline size={17} />
      </IconButton>
      <IconButton
        label="Strikethrough"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run("strikeThrough")}
      >
        <Strikethrough size={17} />
      </IconButton>
      <IconButton
        label="Inline code"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => wrapSelection("code", "inline-code-mark")}
      >
        <Code2 size={17} />
      </IconButton>
      <IconButton
        label="Link"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const href = window.prompt("URL");
          if (href) run("createLink", href);
        }}
      >
        <Link size={17} />
      </IconButton>
    </div>
  );
}
