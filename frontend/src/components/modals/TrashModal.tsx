import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2, X } from "lucide-react";

import { pagesApi } from "../../api/pages.api";
import { useEditorStore } from "../../store/editorStore";
import type { Page } from "../../types/page.types";
import { IconButton } from "../common/IconButton";

type TrashModalProps = {
  workspaceId: string | null;
};

export function TrashModal({ workspaceId }: TrashModalProps) {
  const queryClient = useQueryClient();
  const trashOpen = useEditorStore((state) => state.trashOpen);
  const setTrashOpen = useEditorStore((state) => state.setTrashOpen);
  const trashQuery = useQuery({
    queryKey: ["page-trash", workspaceId],
    queryFn: () => pagesApi.trash(workspaceId as string),
    enabled: trashOpen && Boolean(workspaceId)
  });
  const restorePage = useMutation({
    mutationFn: (pageId: string) => pagesApi.restore(pageId),
    onSuccess(page) {
      queryClient.invalidateQueries({ queryKey: ["page-tree", page.workspace_id] });
      queryClient.invalidateQueries({ queryKey: ["page-trash", page.workspace_id] });
    }
  });

  if (!trashOpen) return null;

  const pages = trashQuery.data ?? [];

  return (
    <div className="modal-backdrop" onMouseDown={() => setTrashOpen(false)}>
      <section className="trash-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="trash-header">
          <div>
            <h2>Trash</h2>
            <p>Pages moved here can be restored with their nested pages.</p>
          </div>
          <IconButton label="Close trash" onClick={() => setTrashOpen(false)}>
            <X size={16} />
          </IconButton>
        </header>
        <div className="trash-list">
          {trashQuery.isLoading ? <div className="trash-empty">Loading...</div> : null}
          {!trashQuery.isLoading && !pages.length ? <div className="trash-empty">Trash is empty</div> : null}
          {pages.map((page: Page) => (
            <article className="trash-row" key={page.id}>
              <div className="trash-page-icon">{page.icon ?? <Trash2 size={15} />}</div>
              <div>
                <strong>{page.title || "Untitled"}</strong>
                <small>Last edited {new Date(page.updated_at).toLocaleString()}</small>
              </div>
              <button type="button" onClick={() => restorePage.mutate(page.id)}>
                <RotateCcw size={15} />
                Restore
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
