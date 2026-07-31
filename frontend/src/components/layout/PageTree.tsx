import {
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  MoreHorizontal,
  PenLine,
  Plus,
  Star,
  Trash2,
  Undo2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconButton } from "../common/IconButton";
import type { PageTreeNode } from "../../types/page.types";
import type { PageUpdate } from "../../types/page.types";

type PageTreeProps = {
  pages: PageTreeNode[];
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentPageId?: string | null) => void;
  onDuplicatePage: (page: PageTreeNode) => void;
  onRenamePage: (page: PageTreeNode) => void;
  onTrashPage: (page: PageTreeNode) => void;
  onMovePage: (page: PageTreeNode, parentPageId: string | null) => void;
  onCopyPageLink: (page: PageTreeNode) => void;
  onOpenPageNewTab: (page: PageTreeNode) => void;
  onUpdatePage: (page: PageTreeNode, payload: PageUpdate) => void;
};

type FlatPage = PageTreeNode & { depth: number };

function flattenPages(pages: PageTreeNode[], depth = 0): FlatPage[] {
  return pages.flatMap((page) => [{ ...page, depth }, ...flattenPages(page.children, depth + 1)]);
}

function descendantIds(page: PageTreeNode): Set<string> {
  return new Set(page.children.flatMap((child) => [child.id, ...descendantIds(child)]));
}

export function PageTree({
  pages,
  currentPageId,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onRenamePage,
  onTrashPage,
  onMovePage,
  onCopyPageLink,
  onOpenPageNewTab,
  onUpdatePage
}: PageTreeProps) {
  const allPages = useMemo(() => flattenPages(pages), [pages]);
  return (
    <nav className="page-tree">
      {pages.map((page) => (
        <PageTreeItem
          key={page.id}
          page={page}
          allPages={allPages}
          currentPageId={currentPageId}
          onSelectPage={onSelectPage}
          onCreatePage={onCreatePage}
          onDuplicatePage={onDuplicatePage}
          onRenamePage={onRenamePage}
          onTrashPage={onTrashPage}
          onMovePage={onMovePage}
          onCopyPageLink={onCopyPageLink}
          onOpenPageNewTab={onOpenPageNewTab}
          onUpdatePage={onUpdatePage}
        />
      ))}
    </nav>
  );
}

type PageTreeItemProps = Omit<PageTreeProps, "pages"> & {
  page: PageTreeNode;
  allPages: FlatPage[];
};

function PageTreeItem({
  page,
  allPages,
  currentPageId,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onRenamePage,
  onTrashPage,
  onMovePage,
  onCopyPageLink,
  onOpenPageNewTab,
  onUpdatePage
}: PageTreeItemProps) {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const hasChildren = page.children.length > 0;
  const blockedMoveIds = useMemo(() => new Set([page.id, ...descendantIds(page)]), [page]);
  const moveTargets = allPages.filter((item) => !blockedMoveIds.has(item.id));

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const runAction = (action: () => void) => {
    action();
    setMenuOpen(false);
    setMoveOpen(false);
  };

  const toggleFavorite = () => {
    onUpdatePage(page, { is_favorite: !page.is_favorite });
  };

  return (
    <div className="page-tree-item" ref={itemRef}>
      <div className={`page-tree-row ${currentPageId === page.id ? "active" : ""}`} onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}>
        <button className="tree-toggle" type="button" onClick={() => setOpen((value) => !value)}>
          {hasChildren ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} /> : <span />}
        </button>
        <button className="page-link" type="button" onClick={() => onSelectPage(page.id)}>
          <span className="page-icon">{page.icon ?? <FileText size={14} />}</span>
          <span>{page.title || "Untitled"}</span>
        </button>
        <IconButton className="page-menu-trigger" label="Page actions" onClick={() => setMenuOpen((value) => !value)}>
          <MoreHorizontal size={14} />
        </IconButton>
        <IconButton label="New nested page" onClick={() => onCreatePage(page.id)}>
          <Plus size={14} />
        </IconButton>
      </div>
      {menuOpen ? (
        <div className="page-action-menu">
          <div className="page-action-title">Page</div>
          <button type="button" onClick={toggleFavorite}>
            <Star size={16} />
            {page.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
          </button>
          <button type="button" onClick={() => runAction(() => onCopyPageLink(page))}>
            <Copy size={16} />
            Copy link
          </button>
          <button type="button" onClick={() => runAction(() => onDuplicatePage(page))}>
            <Copy size={16} />
            Duplicate
            <kbd>Ctrl+D</kbd>
          </button>
          <button type="button" onClick={() => runAction(() => onRenamePage(page))}>
            <PenLine size={16} />
            Rename
          </button>
          <button type="button" onClick={() => setMoveOpen((value) => !value)}>
            <Undo2 size={16} />
            Move to
          </button>
          {moveOpen ? (
            <div className="page-move-list">
              <button type="button" onClick={() => runAction(() => onMovePage(page, null))}>
                Top level
              </button>
              {moveTargets.map((target) => (
                <button key={target.id} type="button" onClick={() => runAction(() => onMovePage(page, target.id))}>
                  <span style={{ paddingLeft: target.depth * 10 }}>{target.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button className="danger" type="button" onClick={() => runAction(() => onTrashPage(page))}>
            <Trash2 size={16} />
            Move to Trash
          </button>
          <button type="button" onClick={() => runAction(() => onOpenPageNewTab(page))}>
            <ExternalLink size={16} />
            Open in new tab
          </button>
          <div className="page-action-foot">Last edited {new Date(page.updated_at).toLocaleString()}</div>
        </div>
      ) : null}
      {hasChildren && open ? (
        <div className="page-tree-children">
          {page.children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              allPages={allPages}
              currentPageId={currentPageId}
              onSelectPage={onSelectPage}
              onCreatePage={onCreatePage}
              onDuplicatePage={onDuplicatePage}
              onRenamePage={onRenamePage}
              onTrashPage={onTrashPage}
              onMovePage={onMovePage}
              onCopyPageLink={onCopyPageLink}
              onOpenPageNewTab={onOpenPageNewTab}
              onUpdatePage={onUpdatePage}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
