import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Workspace } from "../../types/workspace.types";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const workspaces: Workspace[] = [
  { id: "workspace-1", name: "Primary", owner_id: "user-1", created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: "workspace-2", name: "Projects", owner_id: "user-1", created_at: "2026-01-01", updated_at: "2026-01-01" }
];

describe("WorkspaceSwitcher", () => {
  afterEach(cleanup);

  it("highlights the current workspace and closes after creating a workspace", () => {
    const onCreateWorkspace = vi.fn();
    render(
      <WorkspaceSwitcher
        workspaces={workspaces}
        currentWorkspaceId="workspace-1"
        onWorkspaceChange={vi.fn()}
        onCreateWorkspace={onCreateWorkspace}
      />
    );

    const trigger = screen.getByRole("button", { name: /Primary/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const currentMenuItem = screen.getAllByText("Primary")
      .map((element) => element.closest("button"))
      .find((button) => button !== trigger);
    expect(currentMenuItem).toHaveClass("active");
    fireEvent.click(screen.getByText("New workspace"));
    expect(onCreateWorkspace).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("clears the active page when switching workspaces", () => {
    useWorkspaceStore.setState({ currentWorkspaceId: "workspace-1", currentPageId: "page-1" });
    useWorkspaceStore.getState().setWorkspace("workspace-2");

    expect(useWorkspaceStore.getState().currentWorkspaceId).toBe("workspace-2");
    expect(useWorkspaceStore.getState().currentPageId).toBeNull();
    expect(localStorage.getItem("notes.currentPageId")).toBeNull();
  });
});
