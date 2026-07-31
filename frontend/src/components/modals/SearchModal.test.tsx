import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { searchApi } from "../../api/search.api";
import { useAuthStore } from "../../store/authStore";
import { useEditorStore } from "../../store/editorStore";
import { useWorkspaceStore } from "../../store/workspaceStore";
import type { PageTreeNode } from "../../types/page.types";
import { SearchModal } from "./SearchModal";

vi.mock("../../api/search.api", () => ({
  searchApi: { workspace: vi.fn() }
}));

const page: PageTreeNode = {
  id: "page-target",
  workspace_id: "workspace-1",
  parent_page_id: null,
  title: "Target page",
  icon: null,
  cover_url: null,
  order_key: "a1",
  is_archived: false,
  page_font: "default",
  page_width: "default",
  small_text: false,
  is_locked: false,
  is_favorite: false,
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  children: []
};

function renderSearch() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchModal workspaceId="workspace-1" pages={[page]} />
    </QueryClientProvider>
  );
}

describe("SearchModal", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    useAuthStore.setState({
      accessToken: "token",
      refreshToken: "refresh",
      bootstrapped: true,
      user: {
        id: "user-1",
        email: "user@example.com",
        name: "User",
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z"
      }
    });
    useWorkspaceStore.setState({ currentWorkspaceId: "workspace-1", currentPageId: null });
    useEditorStore.setState({ searchOpen: true, searchTargetBlockId: null, homeOpen: true });
    vi.mocked(searchApi.workspace).mockResolvedValue({
      query: "needle",
      results: [
        {
          id: "block-exact",
          type: "block",
          title: "Target page",
          snippet: "The needle is in this block",
          page_id: "page-target",
          workspace_id: "workspace-1",
          created_by: "user-1",
          updated_at: "2026-01-02T00:00:00Z"
        },
        {
          id: "block-duplicate",
          type: "block",
          title: "Target page",
          snippet: "A duplicate page-level result",
          page_id: "page-target",
          workspace_id: "workspace-1",
          created_by: "user-1",
          updated_at: "2026-01-01T00:00:00Z"
        }
      ]
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("deduplicates page results and navigates to the exact matching block", async () => {
    renderSearch();
    fireEvent.change(screen.getByPlaceholderText("Search or ask a question..."), {
      target: { value: "needle" }
    });

    await waitFor(() => expect(searchApi.workspace).toHaveBeenCalledWith("workspace-1", "needle"));
    await waitFor(() => expect(screen.getByText("Search results (1)")).toBeInTheDocument());
    const resultButton = screen.getAllByText("Target page")[0].closest("button");
    expect(resultButton).not.toBeNull();
    fireEvent.click(resultButton as HTMLButtonElement);

    expect(useWorkspaceStore.getState().currentPageId).toBe("page-target");
    expect(useEditorStore.getState().searchTargetBlockId).toBe("block-exact");
    expect(useEditorStore.getState().homeOpen).toBe(false);
    expect(new URL(window.location.href).searchParams.get("page")).toBe("page-target");
    expect(new URL(window.location.href).searchParams.get("block")).toBe("block-exact");
    expect(useEditorStore.getState().searchOpen).toBe(false);
  });
});
