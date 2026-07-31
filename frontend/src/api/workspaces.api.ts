import { request } from "./client";
import type { Workspace } from "../types/workspace.types";

export const workspacesApi = {
  create(name: string) {
    return request<Workspace>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },
  list() {
    return request<Workspace[]>("/api/workspaces");
  },
  update(workspaceId: string, name: string) {
    return request<Workspace>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    });
  },
  delete(workspaceId: string) {
    return request<void>(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
  }
};
