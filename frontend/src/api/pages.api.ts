import { request } from "./client";
import type { Page, PageCreate, PageTreeNode, PageUpdate } from "../types/page.types";

export const pagesApi = {
  create(payload: PageCreate) {
    return request<Page>("/api/pages", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  get(pageId: string) {
    return request<Page>(`/api/pages/${pageId}`);
  },
  update(pageId: string, payload: PageUpdate) {
    return request<Page>(`/api/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  archive(pageId: string) {
    return request<void>(`/api/pages/${pageId}`, { method: "DELETE" });
  },
  restore(pageId: string) {
    return request<Page>(`/api/pages/${pageId}/restore`, { method: "POST" });
  },
  duplicate(pageId: string) {
    return request<{ page: Page; duplicated_at: string }>(`/api/pages/${pageId}/duplicate`, {
      method: "POST"
    });
  },
  tree(workspaceId: string) {
    return request<PageTreeNode[]>(`/api/workspaces/${workspaceId}/pages`);
  },
  trash(workspaceId: string) {
    return request<Page[]>(`/api/workspaces/${workspaceId}/pages/trash`);
  },
  permanentlyDelete(pageId: string) {
    return request<{ deleted_count: number }>(`/api/pages/${pageId}/permanent`, { method: "DELETE" });
  },
  permanentlyDeleteSelected(workspaceId: string, pageIds: string[]) {
    return request<{ deleted_count: number }>(`/api/workspaces/${workspaceId}/pages/trash/permanent-delete`, {
      method: "POST",
      body: JSON.stringify({ page_ids: pageIds })
    });
  },
  emptyTrash(workspaceId: string) {
    return request<{ deleted_count: number }>(`/api/workspaces/${workspaceId}/pages/trash`, {
      method: "DELETE"
    });
  }
};
