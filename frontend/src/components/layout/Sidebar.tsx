import { Home, LogOut, MessageSquare, Plus, Search, Settings, Trash2, UserCircle } from "lucide-react";
import { useState } from "react";

import { PageTree } from "./PageTree";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { CalendarConnection } from "../calendar/CalendarConnection";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import type { PageTreeNode } from "../../types/page.types";
import type { PageUpdate } from "../../types/page.types";
import type { Workspace } from "../../types/workspace.types";

type SidebarProps = {
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
};

export function Sidebar({
  workspaces,
  pages,
  currentWorkspaceId,
  currentPageId,
  onWorkspaceChange,
  onCreateWorkspace,
  onCreatePage,
  onSelectPage,
  onDuplicatePage,
  onRenamePage,
  onTrashPage,
  onMovePage,
  onCopyPageLink,
  onOpenPageNewTab,
  onUpdatePage
}: SidebarProps) {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const setSearchOpen = useEditorStore((state) => state.setSearchOpen);
  const setSettingsOpen = useEditorStore((state) => state.setSettingsOpen);
  const setTrashOpen = useEditorStore((state) => state.setTrashOpen);
  const setCommentsOpen = useEditorStore((state) => state.setCommentsOpen);
  const homeOpen = useEditorStore((state) => state.homeOpen);
  const setHomeOpen = useEditorStore((state) => state.setHomeOpen);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-profile">
        <button className="profile-trigger" type="button" onClick={() => setProfileOpen((value) => !value)}>
          <span className="profile-avatar">{user?.name.slice(0, 1).toUpperCase() ?? "U"}</span>
          <span>
            <strong>{user?.name ?? "User"}</strong>
            <small>{user?.email ?? ""}</small>
          </span>
        </button>
        {profileOpen ? (
          <div className="profile-menu">
            <div className="profile-card">
              <span className="profile-avatar large">{user?.name.slice(0, 1).toUpperCase() ?? "U"}</span>
              <div>
                <strong>{user?.name ?? "User"}</strong>
                <small>{user?.email ?? ""}</small>
              </div>
            </div>
            <button type="button" onClick={() => setSettingsOpen(true)}>
              <Settings size={15} />
              Settings
            </button>
            <button type="button" onClick={logout}>
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceChange={onWorkspaceChange}
        onCreateWorkspace={onCreateWorkspace}
      />
      <div className="sidebar-actions">
        <button
          className={`sidebar-action-pill ${homeOpen ? "active" : ""}`}
          type="button"
          onClick={() => setHomeOpen(true)}
        >
          <Home size={17} />
          Home
        </button>
        <button className="sidebar-action-icon" type="button" onClick={() => setSearchOpen(true)} aria-label="Search" title="Search">
          <Search size={18} />
        </button>
        <button
          className="sidebar-action-icon"
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label="Comments"
          title="Comments"
        >
          <MessageSquare size={18} />
        </button>
        <button className="sidebar-action-icon" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
          <UserCircle size={18} />
        </button>
      </div>
      <div className="sidebar-section-label">Meetings</div>
      <CalendarConnection compact />
      <div className="sidebar-section-label">Pages</div>
      <PageTree
        pages={pages}
        currentPageId={currentPageId}
        onSelectPage={onSelectPage}
        onCreatePage={onCreatePage}
        onDuplicatePage={onDuplicatePage}
        onRenamePage={onRenamePage}
        onTrashPage={onTrashPage}
        onMovePage={onMovePage}
        onCopyPageLink={onCopyPageLink}
        onOpenPageNewTab={onOpenPageNewTab}
        onUpdatePage={onUpdatePage}
      />
      <button className="new-page-row" type="button" onClick={() => onCreatePage(null)}>
        <Plus size={15} />
        New page
      </button>
      <button className="new-page-row trash-entry" type="button" onClick={() => setTrashOpen(true)}>
        <Trash2 size={15} />
        Trash
      </button>
    </aside>
  );
}
