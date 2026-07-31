import type { ReactNode } from "react";

import { PageTopBar } from "./PageTopBar";
import { Sidebar } from "./Sidebar";
import type { PageTreeNode } from "../../types/page.types";
import type { PageUpdate } from "../../types/page.types";
import type { Workspace } from "../../types/workspace.types";

type AppShellProps = {
  workspaces: Workspace[];
  pages: PageTreeNode[];
  currentWorkspaceId: string | null;
  currentPageId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
  onCreateWorkspace: () => void;
  onCreatePage: (parentPageId?: string | null) => void;
  onSelectPage: (pageId: string) => void;
  onDuplicatePage: (page: PageTreeNode) => void;
  onRenamePage: (page: PageTreeNode) => void;
  onTrashPage: (page: PageTreeNode) => void;
  onMovePage: (page: PageTreeNode, parentPageId: string | null) => void;
  onCopyPageLink: (page: PageTreeNode) => void;
  onOpenPageNewTab: (page: PageTreeNode) => void;
  onUpdatePage: (page: PageTreeNode, payload: PageUpdate) => void;
  children: ReactNode;
};

function findPagePath(pages: PageTreeNode[], pageId: string | null, trail: PageTreeNode[] = []): PageTreeNode[] {
  if (!pageId) return [];
  for (const page of pages) {
    const nextTrail = [...trail, page];
    if (page.id === pageId) return nextTrail;
    const childTrail = findPagePath(page.children, pageId, nextTrail);
    if (childTrail.length) return childTrail;
  }
  return [];
}

export function AppShell(props: AppShellProps) {
  const breadcrumbs = findPagePath(props.pages, props.currentPageId);
  const currentPage = breadcrumbs[breadcrumbs.length - 1] ?? null;
  return (
    <div className="app-shell">
      <Sidebar {...props} />
      <main className="app-main">
        <PageTopBar
          breadcrumbs={breadcrumbs}
          currentPage={currentPage}
          onSelectPage={props.onSelectPage}
          onDuplicatePage={props.onDuplicatePage}
          onTrashPage={props.onTrashPage}
          onCopyPageLink={props.onCopyPageLink}
          onOpenPageNewTab={props.onOpenPageNewTab}
          onUpdatePage={props.onUpdatePage}
        />
        {props.children}
      </main>
    </div>
  );
}
