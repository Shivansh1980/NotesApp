import { useQuery } from "@tanstack/react-query";
import { FileText, LayoutList, PanelRight, Search, SlidersHorizontal, Type, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { IconButton } from "../common/IconButton";
import { searchApi } from "../../api/search.api";
import { useDebounce } from "../../hooks/useDebounce";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { PageTreeNode } from "../../types/page.types";
import type { SearchResult } from "../../types/search.types";

type SearchModalProps = {
  workspaceId: string | null;
  pages: PageTreeNode[];
};

function flattenPages(pages: PageTreeNode[]): PageTreeNode[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children)]);
}

function pagePath(pages: PageTreeNode[], pageId: string, trail: string[] = []): string {
  for (const page of pages) {
    const next = [...trail, page.title || "Untitled"];
    if (page.id === pageId) return next.join(" / ");
    const childPath = pagePath(page.children, pageId, next);
    if (childPath) return childPath;
  }
  return "";
}

function pageToResult(page: PageTreeNode): SearchResult {
  return {
    id: page.id,
    type: "page",
    title: page.title || "Untitled",
    snippet: "",
    page_id: null,
    workspace_id: page.workspace_id,
    created_by: page.created_by,
    updated_at: page.updated_at
  };
}

export function SearchModal({ workspaceId, pages }: SearchModalProps) {
  const open = useEditorStore((state) => state.searchOpen);
  const setOpen = useEditorStore((state) => state.setSearchOpen);
  const setHomeOpen = useEditorStore((state) => state.setHomeOpen);
  const setPage = useWorkspaceStore((state) => state.setPage);
  const user = useAuthStore((state) => state.user);
  const currentPageId = useWorkspaceStore((state) => state.currentPageId);
  const [query, setQuery] = useState("");
  const [titleOnly, setTitleOnly] = useState(false);
  const [createdByMe, setCreatedByMe] = useState(false);
  const [currentPageOnly, setCurrentPageOnly] = useState(false);
  const [resultType, setResultType] = useState<"all" | "page" | "block">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debounced = useDebounce(query, 180);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flatPages = useMemo(() => flattenPages(pages), [pages]);
  const results = useQuery({
    queryKey: ["search", workspaceId, debounced],
    queryFn: () => searchApi.workspace(workspaceId as string, debounced),
    enabled: open && Boolean(workspaceId) && debounced.trim().length > 0
  });
  const visibleResults = useMemo(() => {
    const searched = results.data?.results ?? [];
    const base =
      debounced.trim().length > 0
        ? searched
        : flatPages
            .slice()
            .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
            .map(pageToResult);
    return base.filter((item) => {
      if (titleOnly && !item.title.toLowerCase().includes(debounced.trim().toLowerCase())) return false;
      if (createdByMe && item.created_by !== user?.id) return false;
      if (currentPageOnly && (item.page_id ?? item.id) !== currentPageId) return false;
      if (resultType !== "all" && item.type !== resultType) return false;
      return true;
    });
  }, [createdByMe, currentPageId, currentPageOnly, debounced, flatPages, resultType, results.data?.results, titleOnly, user?.id]);
  const selected = visibleResults.find((result) => result.id === selectedId) ?? visibleResults[0] ?? null;
  const selectTargetPage = (pageId: string) => {
    setPage(pageId);
    setHomeOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("page", pageId);
    window.history.replaceState(null, "", url);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    setSelectedId(visibleResults[0]?.id ?? null);
  }, [visibleResults]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="search-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-command">
          <div className="search-input-row">
            <Search size={22} />
            <input
              ref={inputRef}
              value={query}
              placeholder="Search or ask a question..."
              onChange={(event) => setQuery(event.target.value)}
            />
            <IconButton label="Close search" onClick={() => setOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <div className="search-filter-row">
            <button className={titleOnly ? "active" : ""} type="button" onClick={() => setTitleOnly((value) => !value)}>
              <Type size={16} />
              Title only
            </button>
            <button className={createdByMe ? "active" : ""} type="button" onClick={() => setCreatedByMe((value) => !value)}>
              <UserRound size={16} />
              Created by me
            </button>
            <button className={currentPageOnly ? "active" : ""} type="button" onClick={() => setCurrentPageOnly((value) => !value)}>
              <FileText size={16} />
              Current page
            </button>
            <button
              className={resultType !== "all" ? "active" : ""}
              type="button"
              onClick={() => setResultType((value) => value === "all" ? "page" : value === "page" ? "block" : "all")}
            >
              <SlidersHorizontal size={16} />
              {resultType === "all" ? "All results" : resultType === "page" ? "Pages" : "Blocks"}
            </button>
            <span className="search-view-icons">
              <LayoutList size={17} />
              <PanelRight size={17} />
            </span>
          </div>
        </div>
        <div className="search-body">
          <div className="search-results">
            <div className="search-result-heading">{query.trim() ? `Search results (${visibleResults.length})` : "Today"}</div>
            {visibleResults.map((result) => {
              const targetPageId = result.page_id ?? result.id;
              const path = pagePath(pages, targetPageId);
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  className={selected?.id === result.id ? "selected" : ""}
                  type="button"
                  onMouseEnter={() => setSelectedId(result.id)}
                  onClick={() => {
                    selectTargetPage(targetPageId);
                  }}
                >
                  <FileText size={19} />
                  <span>
                    <strong>{result.title}</strong>
                    <small>{path || user?.name || "Workspace"}{result.snippet ? ` - ${result.snippet}` : ""}</small>
                  </span>
                </button>
              );
            })}
            {!visibleResults.length ? <div className="search-empty">No results</div> : null}
          </div>
          <aside className="search-preview">
            {selected ? (
              <>
                <div className="search-preview-actions">
                  <IconButton label="Copy link" onClick={() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("page", selected.page_id ?? selected.id);
                    void navigator.clipboard.writeText(url.toString());
                  }}>
                    <FileText size={15} />
                  </IconButton>
                  <IconButton label="Open" onClick={() => selectTargetPage(selected.page_id ?? selected.id)}>
                    <PanelRight size={15} />
                  </IconButton>
                </div>
                <div>
                  <small>{pagePath(pages, selected.page_id ?? selected.id) || user?.name}</small>
                  <h3>{selected.title}</h3>
                  <p>{selected.snippet || "Open this page to continue editing."}</p>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
