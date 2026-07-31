import { Check, Monitor, Moon, PanelLeft, Sun, X } from "lucide-react";
import { useState } from "react";

import { IconButton } from "../common/IconButton";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import type { Workspace } from "../../types/workspace.types";

type SettingsModalProps = {
  currentWorkspace: Workspace | null;
};

export function SettingsModal({ currentWorkspace }: SettingsModalProps) {
  const open = useEditorStore((state) => state.settingsOpen);
  const setOpen = useEditorStore((state) => state.setSettingsOpen);
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<"appearance" | "workspace">("appearance");

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={() => setOpen(false)}>
      <section className="settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-header">
          <div>
            <h2>Settings</h2>
            <p>Appearance and account</p>
          </div>
          <IconButton label="Close settings" onClick={() => setOpen(false)}>
            <X size={17} />
          </IconButton>
        </header>
        <div className="settings-grid">
          <aside>
            <button className={tab === "appearance" ? "active" : ""} type="button" onClick={() => setTab("appearance")}>
              <Monitor size={16} />
              Appearance
            </button>
            <button className={tab === "workspace" ? "active" : ""} type="button" onClick={() => setTab("workspace")}>
              <PanelLeft size={16} />
              Workspace
            </button>
          </aside>
          <div className="settings-content">
            {tab === "appearance" ? (
              <>
                <section>
                  <h3>Profile</h3>
                  <div className="settings-profile">
                    <span className="profile-avatar large">{user?.name.slice(0, 1).toUpperCase() ?? "U"}</span>
                    <div>
                      <strong>{user?.name ?? "User"}</strong>
                      <small>{user?.email ?? ""}</small>
                    </div>
                  </div>
                </section>
                <section>
                  <h3>Theme</h3>
                  <div className="settings-options two">
                    <button className={theme === "dark" ? "selected" : ""} type="button" onClick={() => setTheme("dark")}>
                      <Moon size={18} />
                      Dark
                      {theme === "dark" ? <Check size={16} /> : null}
                    </button>
                    <button className={theme === "light" ? "selected" : ""} type="button" onClick={() => setTheme("light")}>
                      <Sun size={18} />
                      Light
                      {theme === "light" ? <Check size={16} /> : null}
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section>
                <h3>Workspace</h3>
                <div className="settings-workspace-card">
                  <span className="workspace-avatar">{currentWorkspace?.name.slice(0, 1).toUpperCase() ?? "W"}</span>
                  <div>
                    <strong>{currentWorkspace?.name ?? "Workspace"}</strong>
                    <small>Private workspace</small>
                  </div>
                </div>
                <p className="settings-note">Page appearance is configured per page from the page actions menu.</p>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
