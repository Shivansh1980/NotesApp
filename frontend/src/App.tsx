import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { AuthPanel } from "./components/common/AuthPanel";
import { EditorPage } from "./components/editor/EditorPage";
import { AppShell } from "./components/layout/AppShell";
import { HomeView } from "./components/layout/HomeView";
import { CommentsPanel } from "./components/modals/CommentsPanel";
import { SearchModal } from "./components/modals/SearchModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { TrashModal } from "./components/modals/TrashModal";
import { pagesApi } from "./api/pages.api";
import { workspacesApi } from "./api/workspaces.api";
import { useAuthStore } from "./store/authStore";
import { useEditorStore } from "./store/editorStore";
import { useWorkspaceStore } from "./store/workspaceStore";
import type { PageTreeNode } from "./types/page.types";
import "./styles.css";
import "./notion-parity.css";

function flattenPages(pages: PageTreeNode[]): PageTreeNode[] {
  return pages.flatMap((page) => [page, ...flattenPages(page.children)]);
}

export default function App() {
  const queryClient = useQueryClient();
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const user = useAuthStore((state) => state.user);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const currentPageId = useWorkspaceStore((state) => state.currentPageId);
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace);
  const setPage = useWorkspaceStore((state) => state.setPage);
  const theme = useEditorStore((state) => state.theme);
  const homeOpen = useEditorStore((state) => state.homeOpen);
  const setHomeOpen = useEditorStore((state) => state.setHomeOpen);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspacesApi.list,
    enabled: Boolean(user)
  });
  const pages = useQuery({
    queryKey: ["page-tree", currentWorkspaceId],
    queryFn: () => pagesApi.tree(currentWorkspaceId as string),
    enabled: Boolean(currentWorkspaceId)
  });
  const createWorkspace = useMutation({
    mutationFn: () => workspacesApi.create("New workspace"),
    onSuccess(workspace) {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setWorkspace(workspace.id);
    }
  });
  const createPage = useMutation({
    mutationFn: (parentPageId?: string | null) =>
      pagesApi.create({
        workspace_id: currentWorkspaceId as string,
        parent_page_id: parentPageId ?? null,
        title: "Untitled"
      }),
    onSuccess(page) {
      queryClient.invalidateQueries({ queryKey: ["page-tree", page.workspace_id] });
      setPage(page.id);
      setHomeOpen(false);
    }
  });
  const updatePage = useMutation({
    mutationFn: ({ pageId, payload }: { pageId: string; payload: Parameters<typeof pagesApi.update>[1] }) =>
      pagesApi.update(pageId, payload),
    onSuccess(page) {
      queryClient.setQueryData(["page", page.id], page);
      queryClient.invalidateQueries({ queryKey: ["page-tree", page.workspace_id] });
    }
  });
  const duplicatePage = useMutation({
    mutationFn: (pageId: string) => pagesApi.duplicate(pageId),
    onSuccess(result) {
      queryClient.invalidateQueries({ queryKey: ["page-tree", result.page.workspace_id] });
      selectPage(result.page.id);
    }
  });
  const archivePage = useMutation({
    mutationFn: (pageId: string) => pagesApi.archive(pageId),
    onSuccess(_, pageId) {
      if (currentWorkspaceId) {
        queryClient.invalidateQueries({ queryKey: ["page-tree", currentWorkspaceId] });
        queryClient.invalidateQueries({ queryKey: ["page-trash", currentWorkspaceId] });
      }
      if (currentPageId === pageId) setPage(null);
    }
  });

  const selectPage = useCallback(
    (pageId: string) => {
      setPage(pageId);
      setHomeOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("page", pageId);
      window.history.replaceState(null, "", url);
    },
    [setHomeOpen, setPage]
  );

  const copyPageLink = useCallback((page: PageTreeNode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page.id);
    void navigator.clipboard.writeText(url.toString());
  }, []);

  const openPageNewTab = useCallback((page: PageTreeNode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", page.id);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  }, []);

  const renamePage = useCallback(
    (page: PageTreeNode) => {
      const title = window.prompt("Rename page", page.title || "Untitled");
      if (title === null) return;
      updatePage.mutate({ pageId: page.id, payload: { title: title.trim() || "Untitled" } });
    },
    [updatePage]
  );

  const movePage = useCallback(
    (page: PageTreeNode, parentPageId: string | null) => {
      updatePage.mutate({ pageId: page.id, payload: { parent_page_id: parentPageId } });
    },
    [updatePage]
  );

  useEffect(() => {
    if (!workspaces.data?.length) return;
    if (!currentWorkspaceId || !workspaces.data.some((workspace) => workspace.id === currentWorkspaceId)) {
      setWorkspace(workspaces.data[0].id);
    }
  }, [currentWorkspaceId, setWorkspace, workspaces.data]);

  useEffect(() => {
    const flatPages = flattenPages(pages.data ?? []);
    if (!flatPages.length) return;
    const pageFromUrl = new URLSearchParams(window.location.search).get("page");
    if (pageFromUrl && flatPages.some((page) => page.id === pageFromUrl)) {
      if (currentPageId !== pageFromUrl) setPage(pageFromUrl);
      return;
    }
    if (!currentPageId || !flatPages.some((page) => page.id === currentPageId)) {
      selectPage(flatPages[0].id);
    }
  }, [currentPageId, pages.data, selectPage, setPage]);

  if (!bootstrapped) return <div className="boot-screen" />;
  if (!user) return <AuthPanel />;

  return (
    <>
      <AppShell
        workspaces={workspaces.data ?? []}
        pages={pages.data ?? []}
        currentWorkspaceId={currentWorkspaceId}
        currentPageId={homeOpen ? null : currentPageId}
        onWorkspaceChange={setWorkspace}
        onCreateWorkspace={() => createWorkspace.mutate()}
        onCreatePage={(parentPageId) => createPage.mutate(parentPageId)}
        onSelectPage={selectPage}
        onDuplicatePage={(page) => duplicatePage.mutate(page.id)}
        onRenamePage={renamePage}
        onTrashPage={(page) => archivePage.mutate(page.id)}
        onMovePage={movePage}
        onCopyPageLink={copyPageLink}
        onOpenPageNewTab={openPageNewTab}
        onUpdatePage={(page, payload) => updatePage.mutate({ pageId: page.id, payload })}
      >
        {homeOpen ? (
          <HomeView
            pages={pages.data ?? []}
            onSelectPage={selectPage}
            onCreatePage={() => createPage.mutate(null)}
          />
        ) : (
          <EditorPage pageId={currentPageId} workspaceId={currentWorkspaceId} />
        )}
      </AppShell>
      <SearchModal workspaceId={currentWorkspaceId} pages={pages.data ?? []} />
      <SettingsModal
        currentWorkspace={workspaces.data?.find((workspace) => workspace.id === currentWorkspaceId) ?? null}
      />
      <TrashModal workspaceId={currentWorkspaceId} />
      <CommentsPanel pageId={currentPageId} />
    </>
  );
}
