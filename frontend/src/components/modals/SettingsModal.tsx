import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Monitor, Moon, PanelLeft, Save, Sun, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { workspacesApi } from "../../api/workspaces.api";
import { CalendarConnection } from "../calendar/CalendarConnection";
import { IconButton } from "../common/IconButton";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import type { Workspace } from "../../types/workspace.types";

type SettingsTab = "appearance" | "workspace" | "calendar";

type SettingsModalProps = {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  onWorkspaceChange: (workspaceId: string | null) => void;
};

export function SettingsModal({ currentWorkspace, workspaces, onWorkspaceChange }: SettingsModalProps) {
  const queryClient = useQueryClient();
  const open = useEditorStore((state) => state.settingsOpen);
  const setOpen = useEditorStore((state) => state.setSettingsOpen);
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owner = Boolean(currentWorkspace && user && currentWorkspace.owner_id === user.id);

  useEffect(() => {
    setWorkspaceName(currentWorkspace?.name ?? "");
    setConfirmDelete(false);
  }, [currentWorkspace?.id, currentWorkspace?.name]);

  useEffect(() => {
    const openCalendarSettings = () => {
      setTab("calendar");
      setOpen(true);
    };
    document.addEventListener("notes:open-calendar-settings", openCalendarSettings);
    return () => document.removeEventListener("notes:open-calendar-settings", openCalendarSettings);
  }, [setOpen]);

  useEffect(() => {
    const openWorkspaceSettings = () => {
      setTab("workspace");
      setOpen(true);
    };
    document.addEventListener("notes:open-workspace-settings", openWorkspaceSettings);
    return () => document.removeEventListener("notes:open-workspace-settings", openWorkspaceSettings);
  }, [setOpen]);

  const renameWorkspace = useMutation({
    mutationFn: () => workspacesApi.update(currentWorkspace?.id as string, workspaceName.trim()),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    }
  });
  const deleteWorkspace = useMutation({
    mutationFn: () => workspacesApi.delete(currentWorkspace?.id as string),
    onSuccess() {
      const nextWorkspace = workspaces.find((workspace) => workspace.id !== currentWorkspace?.id) ?? null;
      onWorkspaceChange(nextWorkspace?.id ?? null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setConfirmDelete(false);
      setOpen(false);
    }
  });

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-header">
          <div>
            <h2>Settings</h2>
            <p>Account, workspace, and connections</p>
          </div>
          <IconButton label="Close settings" onClick={() => setOpen(false)}><X size={17} /></IconButton>
        </header>
        <div className="settings-grid">
          <aside>
            <button className={tab === "appearance" ? "active" : ""} type="button" onClick={() => setTab("appearance")}>
              <Monitor size={16} />Appearance
            </button>
            <button className={tab === "workspace" ? "active" : ""} type="button" onClick={() => setTab("workspace")}>
              <PanelLeft size={16} />Workspace
            </button>
            <button className={tab === "calendar" ? "active" : ""} type="button" onClick={() => setTab("calendar")}>
              <CalendarDays size={16} />Calendar
            </button>
          </aside>
          <div className="settings-content">
            {tab === "appearance" ? (
              <>
                <section>
                  <h3>Profile</h3>
                  <div className="settings-profile">
                    <span className="profile-avatar large">{user?.name.slice(0, 1).toUpperCase() ?? "U"}</span>
                    <div><strong>{user?.name ?? "User"}</strong><small>{user?.email ?? ""}</small></div>
                  </div>
                </section>
                <section>
                  <h3>Theme</h3>
                  <div className="settings-options two">
                    <button className={theme === "dark" ? "selected" : ""} type="button" onClick={() => setTheme("dark")}>
                      <Moon size={18} />Dark{theme === "dark" ? <Check size={16} /> : null}
                    </button>
                    <button className={theme === "light" ? "selected" : ""} type="button" onClick={() => setTheme("light")}>
                      <Sun size={18} />Light{theme === "light" ? <Check size={16} /> : null}
                    </button>
                  </div>
                </section>
              </>
            ) : null}

            {tab === "workspace" ? (
              <section className="workspace-settings">
                <h3>Workspace</h3>
                <div className="settings-workspace-card">
                  <span className="workspace-avatar">{currentWorkspace?.name.slice(0, 1).toUpperCase() ?? "W"}</span>
                  <div><strong>{currentWorkspace?.name ?? "Workspace"}</strong><small>{owner ? "Owner" : "Member"}</small></div>
                </div>
                <label className="settings-field">
                  <span>Name</span>
                  <div>
                    <input value={workspaceName} disabled={!owner} maxLength={160} onChange={(event) => setWorkspaceName(event.target.value)} />
                    <button
                      type="button"
                      disabled={!owner || !workspaceName.trim() || workspaceName.trim() === currentWorkspace?.name || renameWorkspace.isPending}
                      onClick={() => renameWorkspace.mutate()}
                    ><Save size={15} />Save</button>
                  </div>
                </label>
                {owner ? (
                  <div className="workspace-danger-zone">
                    <div><strong>Delete workspace</strong><p>Permanently removes every page, upload, and member in this workspace.</p></div>
                    <button className="danger" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} />Delete workspace</button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {tab === "calendar" ? (
              <section>
                <h3>Google Calendar</h3>
                <p className="settings-note">Connect read-only access to show your upcoming events in the sidebar.</p>
                <CalendarConnection />
              </section>
            ) : null}
          </div>
        </div>

        {confirmDelete ? (
          <div className="settings-confirm" role="alertdialog" aria-modal="true" aria-label="Confirm workspace deletion">
            <h3>Delete {currentWorkspace?.name}?</h3>
            <p>This cannot be undone. All pages and files in this workspace will be permanently removed.</p>
            <div><button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="danger" type="button" disabled={deleteWorkspace.isPending} onClick={() => deleteWorkspace.mutate()}>Delete workspace</button></div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
