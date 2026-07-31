import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Workspace } from "../../types/workspace.types";

type WorkspaceSwitcherProps = {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string | null) => void;
  onCreateWorkspace: () => void;
};

export function WorkspaceSwitcher({
  workspaces,
  currentWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="workspace-switcher" ref={rootRef}>
      <button
        className="workspace-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="workspace-avatar">{currentWorkspace?.name.slice(0, 1).toUpperCase() ?? "N"}</span>
        <span className="workspace-copy">
          <strong>{currentWorkspace?.name ?? "Workspace"}</strong>
          <small>Private workspace</small>
        </span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="workspace-menu" role="menu">
          <div className="workspace-menu-title">Workspaces</div>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className={workspace.id === currentWorkspaceId ? "active" : ""}
              type="button"
              onClick={() => {
                onWorkspaceChange(workspace.id);
                setOpen(false);
              }}
            >
              <span className="workspace-avatar small">{workspace.name.slice(0, 1).toUpperCase()}</span>
              <span>{workspace.name}</span>
              {workspace.id === currentWorkspaceId ? <Check size={15} /> : null}
            </button>
          ))}
          <button className="workspace-create-row" type="button" onClick={() => {
            setOpen(false);
            onCreateWorkspace();
          }}>
            <Plus size={15} />
            New workspace
          </button>
          <button className="workspace-create-row" type="button" onClick={() => {
            setOpen(false);
            document.dispatchEvent(new CustomEvent("notes:open-workspace-settings"));
          }}>
            <Settings size={15} />
            Workspace settings
          </button>
        </div>
      ) : null}
    </div>
  );
}
