import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Link2,
  Lock,
  LockOpen,
  Maximize2,
  MoreHorizontal,
  Search,
  Settings2,
  Star,
  Trash2,
  Type,
  Upload
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useEditorStore } from "../../store/editorStore";
import type { PageTreeNode, PageUpdate } from "../../types/page.types";
import type { PasteBlock } from "../../types/block.types";
import { copyCurrentPageContents, exportCurrentPage, type ExportFormat } from "../../utils/exportUtils";
import { htmlToBlocks, plainTextToBlocks } from "../../utils/pasteUtils";
import { IconButton } from "../common/IconButton";

type PageTopBarProps = {
  breadcrumbs: PageTreeNode[];
  currentPage: PageTreeNode | null;
  onSelectPage: (pageId: string) => void;
  onDuplicatePage: (page: PageTreeNode) => void;
  onTrashPage: (page: PageTreeNode) => void;
  onCopyPageLink: (page: PageTreeNode) => void;
  onOpenPageNewTab: (page: PageTreeNode) => void;
  onUpdatePage: (page: PageTreeNode, payload: PageUpdate) => void;
};

const exportOptions: Array<{ format: ExportFormat; label: string }> = [
  { format: "pdf", label: "PDF" },
  { format: "word", label: "Word (.doc)" },
  { format: "html", label: "HTML" },
  { format: "markdown", label: "Markdown" },
  { format: "plain", label: "Plain text" },
  { format: "json", label: "JSON" }
];

export function PageTopBar({
  breadcrumbs,
  currentPage,
  onSelectPage,
  onDuplicatePage,
  onTrashPage,
  onCopyPageLink,
  onOpenPageNewTab,
  onUpdatePage
}: PageTopBarProps) {
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [actionQuery, setActionQuery] = useState("");
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);

  useEffect(() => {
    if (!menuOpen && !shareOpen) return;
    const close = (event: MouseEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setShareOpen(false);
        setExportOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setShareOpen(false);
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, shareOpen]);

  useEffect(() => {
    if (!menuOpen) setActionQuery("");
  }, [menuOpen]);

  const run = (action: () => void) => {
    action();
    setMenuOpen(false);
    setShareOpen(false);
    setExportOpen(false);
  };

  const update = (payload: PageUpdate) => {
    if (currentPage) onUpdatePage(currentPage, payload);
  };

  const visible = (label: string) => label.toLowerCase().includes(actionQuery.trim().toLowerCase());

  const importFile = async (file: File) => {
    if (!currentPage) return;
    const source = await file.text();
    let blocks: PasteBlock[] = [];
    if (/\.html?$/i.test(file.name) || file.type === "text/html") {
      blocks = htmlToBlocks(source);
    } else {
      blocks = plainTextToBlocks(source);
    }
    if (!blocks.length) return;
    window.dispatchEvent(
      new CustomEvent("notes:import-blocks", {
        detail: { pageId: currentPage.id, blocks }
      })
    );
  };

  if (!currentPage && breadcrumbs.length === 0) {
    return (
      <header className="page-topbar page-topbar-home">
        <strong>Home</strong>
      </header>
    );
  }

  return (
    <header className="page-topbar">
      <nav className="breadcrumb-nav" aria-label="Breadcrumb">
        {breadcrumbs.map((page, index) => (
          <span className="breadcrumb-part" key={page.id}>
            {index > 0 ? <span className="breadcrumb-separator">/</span> : null}
            <button type="button" onClick={() => onSelectPage(page.id)}>
              <span className="breadcrumb-icon">{page.icon ?? <FileText size={14} />}</span>
              <span>{page.title || "Untitled"}</span>
              <ChevronDown size={13} className="breadcrumb-chevron" />
            </button>
          </span>
        ))}
      </nav>
      <div className="topbar-actions" ref={actionsRef}>
        <span className="edited-label">
          {currentPage ? `Edited ${new Date(currentPage.updated_at).toLocaleDateString()}` : ""}
        </span>
        <button
          className="share-button"
          type="button"
          aria-expanded={shareOpen}
          onClick={() => {
            setShareOpen((value) => !value);
            setMenuOpen(false);
          }}
        >
          <Lock size={14} />
          Share
          <ChevronDown size={13} />
        </button>
        <IconButton label="Copy link" onClick={() => currentPage && onCopyPageLink(currentPage)}>
          <Link2 size={17} />
        </IconButton>
        <IconButton
          label={currentPage?.is_favorite ? "Remove from favorites" : "Add to favorites"}
          active={Boolean(currentPage?.is_favorite)}
          onClick={() => currentPage && update({ is_favorite: !currentPage.is_favorite })}
        >
          <Star size={17} fill={currentPage?.is_favorite ? "currentColor" : "none"} />
        </IconButton>
        <IconButton
          label="More page actions"
          active={menuOpen}
          onClick={() => {
            setMenuOpen((value) => !value);
            setShareOpen(false);
          }}
        >
          <MoreHorizontal size={17} />
        </IconButton>

        {shareOpen && currentPage ? (
          <section className="share-popover" aria-label="Share page">
            <header>
              <strong>Share {currentPage.title || "Untitled"}</strong>
              <small>Private workspace</small>
            </header>
            <p>Only members of this workspace with access can open this page.</p>
            <button type="button" onClick={() => run(() => onCopyPageLink(currentPage))}>
              <Link2 size={16} />
              Copy page link
            </button>
          </section>
        ) : null}

        {menuOpen && currentPage ? (
          <div className="topbar-menu">
            <label className="action-search">
              <Search size={15} />
              <input
                value={actionQuery}
                placeholder="Search actions..."
                onChange={(event) => setActionQuery(event.target.value)}
              />
            </label>
            {!actionQuery.trim() ? (
              <div className="font-choices">
                {(["default", "serif", "mono"] as const).map((font) => (
                  <button
                    type="button"
                    key={font}
                    className={currentPage.page_font === font ? "selected" : ""}
                    onClick={() => update({ page_font: font })}
                  >
                    <span>Ag</span>
                    {font === "default" ? "Default" : font === "serif" ? "Serif" : "Mono"}
                    {currentPage.page_font === font ? <Check size={14} /> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {visible("Copy link") ? (
              <button type="button" onClick={() => run(() => onCopyPageLink(currentPage))}>
                <Link2 size={16} />
                Copy link
                <kbd>Ctrl+Alt+L</kbd>
              </button>
            ) : null}
            {visible("Copy page contents") ? (
              <button type="button" onClick={() => run(() => void copyCurrentPageContents())}>
                <Copy size={16} />
                Copy page contents
              </button>
            ) : null}
            {visible("Duplicate") ? (
              <button type="button" onClick={() => run(() => onDuplicatePage(currentPage))}>
                <Copy size={16} />
                Duplicate
                <kbd>Ctrl+D</kbd>
              </button>
            ) : null}
            {visible("Move to Trash") ? (
              <button type="button" onClick={() => run(() => onTrashPage(currentPage))}>
                <Trash2 size={16} />
                Move to Trash
              </button>
            ) : null}
            {!actionQuery.trim() ? <div className="menu-divider" /> : null}
            {visible("Small text") ? (
              <button type="button" onClick={() => update({ small_text: !currentPage.small_text })}>
                <Type size={16} />
                Small text
                <span className={`menu-switch ${currentPage.small_text ? "on" : ""}`} />
              </button>
            ) : null}
            {visible("Full width") ? (
              <button
                type="button"
                onClick={() => update({ page_width: currentPage.page_width === "full" ? "default" : "full" })}
              >
                <Maximize2 size={16} />
                Full width
                <span className={`menu-switch ${currentPage.page_width === "full" ? "on" : ""}`} />
              </button>
            ) : null}
            {visible("Customize page") ? (
              <button type="button" onClick={() => run(() => setSettingsOpen(true))}>
                <Settings2 size={16} />
                Customize page
              </button>
            ) : null}
            {!actionQuery.trim() ? <div className="menu-divider" /> : null}
            {visible("Lock page") || visible("Unlock page") ? (
              <button type="button" onClick={() => update({ is_locked: !currentPage.is_locked })}>
                {currentPage.is_locked ? <LockOpen size={16} /> : <Lock size={16} />}
                {currentPage.is_locked ? "Unlock page" : "Lock page"}
                <span className={`menu-switch ${currentPage.is_locked ? "on" : ""}`} />
              </button>
            ) : null}
            {!actionQuery.trim() ? <div className="menu-divider" /> : null}
            {visible("Import") ? (
              <button type="button" onClick={() => importRef.current?.click()}>
                <Upload size={16} />
                Import
              </button>
            ) : null}
            {visible("Export") ? (
              <button type="button" onClick={() => setExportOpen((value) => !value)}>
                <Download size={16} />
                Export
                <ChevronRight size={15} className="menu-arrow" />
              </button>
            ) : null}
            {exportOpen ? (
              <div className="export-submenu">
                {exportOptions.map((option) => (
                  <button key={option.format} type="button" onClick={() => run(() => exportCurrentPage(option.format))}>
                    <FileDown size={15} />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            {visible("Open in new tab") ? (
              <button type="button" onClick={() => run(() => onOpenPageNewTab(currentPage))}>
                <ExternalLink size={16} />
                Open in new tab
              </button>
            ) : null}
            {actionQuery.trim() && ![
              "Copy link",
              "Copy page contents",
              "Duplicate",
              "Move to Trash",
              "Small text",
              "Full width",
              "Customize page",
              currentPage.is_locked ? "Unlock page" : "Lock page",
              "Import",
              "Export",
              "Open in new tab"
            ].some(visible) ? <div className="action-empty">No matching actions</div> : null}
          </div>
        ) : null}
        <input
          ref={importRef}
          className="visually-hidden"
          type="file"
          accept=".txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </header>
  );
}
