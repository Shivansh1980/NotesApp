import { request } from "./client";

export type Comment = {
  id: string;
  page_id: string;
  block_id: string | null;
  user_id: string;
  text: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
};

export const commentsApi = {
  create(pageId: string, blockId: string | null, text: string) {
    return request<Comment>("/api/comments", {
      method: "POST",
      body: JSON.stringify({ page_id: pageId, block_id: blockId, text })
    });
  },
  listForBlock(blockId: string) {
    return request<Comment[]>(`/api/blocks/${blockId}/comments`);
  },
  listForPage(pageId: string) {
    return request<Comment[]>(`/api/pages/${pageId}/comments`);
  },
  update(commentId: string, payload: Partial<Pick<Comment, "text" | "resolved">>) {
    return request<Comment>(`/api/comments/${commentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  remove(commentId: string) {
    return request<void>(`/api/comments/${commentId}`, { method: "DELETE" });
  }
};
