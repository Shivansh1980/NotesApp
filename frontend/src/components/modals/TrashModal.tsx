import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { pagesApi } from "../../api/pages.api";
import { useEditorStore } from "../../store/editorStore";
import type { Page } from "../../types/page.types";
import { IconButton } from "../common/IconButton";

type TrashModalProps = {
  workspaceId: string | null;
};

type DeleteIntent = "selected" | "all" | null;

export function TrashModal({ workspaceId }: TrashModalProps) {
  const queryClient = useQueryClient();
  const trashOpen = useEditorStore((state) => state.trashOpen);
  const setTrashOpen = useEditorStore((state) => state.setTrashOpen);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteIntent, setDeleteIntent] = useState<DeleteIntent>(null);
  const trashQuery = useQuery({
    queryKey: ["page-trash", workspaceId],
    queryFn: () => pagesApi.trash(workspaceId as string),
    enabled: trashOpen && Boolean(workspaceId)
  });
  const refreshPages = () => {
    queryClient.invalidateQueries({ queryKey: ["page-tree", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["page-trash", workspaceId] });
  };
  const restorePages = useMutation({
    mutationFn: (pageIds: string[]) => Promise.all(pageIds.map((pageId) => pagesApi.restore(pageId))),
    onSuccess() {
      setSelectedIds(new Set());
      refreshPages();
    }
  });
  const deletePages = useMutation({
    mutationFn: ({ intent, pageIds }: { intent: Exclude<DeleteIntent, null>; pageIds: string[] }) => {
      if (!workspaceId) throw new Error("No workspace selected");
      return intent === "all"
        ? pagesApi.emptyTrash(workspaceId)
        : pagesApi.permanentlyDeleteSelected(workspaceId, pageIds);
    },
    onSuccess() {
      setSelectedIds(new Set());
      setDeleteIntent(null);
      refreshPages();
    }
  });

  useEffect(() => {
    setQuery("");
    setSelectedIds(new Set());
    setDeleteIntent(null);
  }, [trashOpen, workspaceId]);

  const pages = trashQuery.data ?? [];
  const filteredPages = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return pages;
    return pages.filter((page) => (page.title || "Untitled").toLowerCase().includes(normalized));
  }, [pages, query]);
  const allVisibleSelected = filteredPages.length > 0 && filteredPages.every((page) => selectedIds.has(page.id));
  const busy = restorePages.isPending || deletePages.isPending;

  if (!trashOpen) return null;

  const toggleSelection = (pageId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={() => setTrashOpen(false)}>
      <section className="trash-modal" role="dialog" aria-modal="true" aria-label="Trash" onMouseDown={(event) => event.stopPropagation()}>
        <header className="trash-header">
          <div>
            <h2>Trash</h2>
            <p>Restore pages or permanently remove them from this workspace.</p>
          </div>
          <IconButton label="Close trash" onClick={() => setTrashOpen(false)}>
            <X size={16} />
          </IconButton>
        </header>

        <div className="trash-search-row">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages in Trash" />
        </div>

        {pages.length ? (
          <div className="trash-toolbar">
            <label>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    filteredPages.forEach((page) => (allVisibleSelected ? next.delete(page.id) : next.add(page.id)));
                    return next;
                  });
                }}
              />
              <span>{selectedIds.size ? `${selectedIds.size} selected` : "Select all"}</span>
            </label>
            <div>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => restorePages.mutate([...selectedIds])}>
                <RotateCcw size={14} />
                Restore
              </button>
              <button className="danger" type="button" disabled={!selectedIds.size || busy} onClick={() => setDeleteIntent("selected")}>
                <Trash2 size={14} />
                Delete selected
              </button>
              <button className="danger quiet" type="button" disabled={busy} onClick={() => setDeleteIntent("all")}>
                Empty trash
              </button>
            </div>
          </div>
        ) : null}

        <div className="trash-list">
          {trashQuery.isLoading ? <div className="trash-empty">Loading trash...</div> : null}
          {trashQuery.isError ? <div className="trash-empty error">Unable to load trash.</div> : null}
          {!trashQuery.isLoading && !filteredPages.length ? (
            <div className="trash-empty">{query.trim() ? "No matching pages" : "Trash is empty"}</div>
          ) : null}
          {filteredPages.map((page: Page) => (
            <article className={`trash-row ${selectedIds.has(page.id) ? "selected" : ""}`} key={page.id}>
              <label className="trash-select" aria-label={`Select ${page.title || "Untitled"}`}>
                <input type="checkbox" checked={selectedIds.has(page.id)} onChange={() => toggleSelection(page.id)} />
                <span>{selectedIds.has(page.id) ? <Check size={13} /> : null}</span>
              </label>
              <div className="trash-page-icon">{page.icon ?? <Trash2 size={15} />}</div>
              <div className="trash-page-copy">
                <strong>{page.title || "Untitled"}</strong>
                <small>Last edited {new Date(page.updated_at).toLocaleString()}</small>
              </div>
              <div className="trash-row-actions">
                <IconButton label={`Restore ${page.title || "Untitled"}`} disabled={busy} onClick={() => restorePages.mutate([page.id])}>
                  <RotateCcw size={15} />
                </IconButton>
                <IconButton label={`Delete ${page.title || "Untitled"} permanently`} disabled={busy} onClick={() => {
                  setSelectedIds(new Set([page.id]));
                  setDeleteIntent("selected");
                }}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </article>
          ))}
        </div>

        <footer className="trash-footer">Items remain here until you permanently delete them.</footer>

        {deleteIntent ? (
          <div className="trash-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm permanent deletion">
            <div>
              <Trash2 size={20} />
              <h3>{deleteIntent === "all" ? "Empty trash?" : "Delete selected pages?"}</h3>
              <p>This action permanently removes the pages and their contents. It cannot be undone.</p>
            </div>
            <div className="trash-confirm-actions">
              <button type="button" onClick={() => setDeleteIntent(null)}>Cancel</button>
              <button
                className="danger"
                type="button"
                disabled={busy}
                onClick={() => deletePages.mutate({ intent: deleteIntent, pageIds: [...selectedIds] })}
              >
                Permanently delete
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
