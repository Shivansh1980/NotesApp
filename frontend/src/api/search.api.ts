import { request } from "./client";
import type { SearchResponse } from "../types/search.types";

export const searchApi = {
  workspace(workspaceId: string, query: string) {
    return request<SearchResponse>(
      `/api/search?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(query)}`
    );
  },
  page(pageId: string, query: string) {
    return request<SearchResponse>(`/api/pages/${pageId}/search?q=${encodeURIComponent(query)}`);
  }
};
