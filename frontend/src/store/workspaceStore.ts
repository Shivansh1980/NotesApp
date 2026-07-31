import { create } from "zustand";

type WorkspaceState = {
  currentWorkspaceId: string | null;
  currentPageId: string | null;
  setWorkspace: (workspaceId: string | null) => void;
  setPage: (pageId: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentWorkspaceId: localStorage.getItem("notes.currentWorkspaceId"),
  currentPageId: localStorage.getItem("notes.currentPageId"),
  setWorkspace(workspaceId) {
    if (workspaceId) localStorage.setItem("notes.currentWorkspaceId", workspaceId);
    else localStorage.removeItem("notes.currentWorkspaceId");
    localStorage.removeItem("notes.currentPageId");
    set({ currentWorkspaceId: workspaceId, currentPageId: null });
  },
  setPage(pageId) {
    if (pageId) localStorage.setItem("notes.currentPageId", pageId);
    else localStorage.removeItem("notes.currentPageId");
    set({ currentPageId: pageId });
  }
}));
