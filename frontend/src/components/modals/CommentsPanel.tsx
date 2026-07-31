import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessageSquare, Send, Trash2, X } from "lucide-react";
import { useState } from "react";

import { commentsApi } from "../../api/comments.api";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import { IconButton } from "../common/IconButton";

type CommentsPanelProps = {
  pageId: string | null;
};

export function CommentsPanel({ pageId }: CommentsPanelProps) {
  const queryClient = useQueryClient();
  const open = useEditorStore((state) => state.commentsOpen);
  const setOpen = useEditorStore((state) => state.setCommentsOpen);
  const user = useAuthStore((state) => state.user);
  const [draft, setDraft] = useState("");
  const comments = useQuery({
    queryKey: ["page-comments", pageId],
    queryFn: () => commentsApi.listForPage(pageId as string),
    enabled: open && Boolean(pageId)
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
  const createComment = useMutation({
    mutationFn: (text: string) => commentsApi.create(pageId as string, null, text),
    onSuccess() {
      setDraft("");
      void refresh();
    }
  });
  const resolveComment = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => commentsApi.update(id, { resolved }),
    onSuccess: refresh
  });
  const deleteComment = useMutation({
    mutationFn: commentsApi.remove,
    onSuccess: refresh
  });

  if (!open) return null;

  return (
    <aside className="comments-panel" aria-label="Comments">
      <header>
        <div>
          <MessageSquare size={18} />
          <strong>Comments</strong>
        </div>
        <IconButton label="Close comments" onClick={() => setOpen(false)}>
          <X size={17} />
        </IconButton>
      </header>
      <div className="comments-list">
        {comments.isLoading ? <div className="comments-empty">Loading comments...</div> : null}
        {comments.data?.map((comment) => (
          <article className={comment.resolved ? "resolved" : ""} key={comment.id}>
            <span className="profile-avatar small">
              {comment.user_id === user?.id ? user.name.slice(0, 1).toUpperCase() : "M"}
            </span>
            <div>
              <div className="comment-meta">
                <strong>{comment.user_id === user?.id ? user.name : "Workspace member"}</strong>
                <time>{new Date(comment.created_at).toLocaleString()}</time>
              </div>
              <p>{comment.text}</p>
              {comment.block_id ? <button className="comment-block-link" type="button" onClick={() => {
                document.getElementById(`block-${comment.block_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}>Open block</button> : null}
            </div>
            <div className="comment-actions">
              <IconButton
                label={comment.resolved ? "Reopen comment" : "Resolve comment"}
                active={comment.resolved}
                onClick={() => resolveComment.mutate({ id: comment.id, resolved: !comment.resolved })}
              >
                <Check size={15} />
              </IconButton>
              <IconButton label="Delete comment" onClick={() => deleteComment.mutate(comment.id)}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </article>
        ))}
        {!comments.isLoading && !comments.data?.length ? <div className="comments-empty">No comments on this page.</div> : null}
      </div>
      <form
        className="comment-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (text) createComment.mutate(text);
        }}
      >
        <textarea
          value={draft}
          placeholder="Add a comment..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") event.currentTarget.form?.requestSubmit();
          }}
        />
        <IconButton label="Post comment" active={Boolean(draft.trim())} type="submit">
          <Send size={16} />
        </IconButton>
      </form>
    </aside>
  );
}
