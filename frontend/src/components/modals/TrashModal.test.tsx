import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pagesApi } from "../../api/pages.api";
import { useEditorStore } from "../../store/editorStore";
import type { Page } from "../../types/page.types";
import { TrashModal } from "./TrashModal";

vi.mock("../../api/pages.api", () => ({
  pagesApi: {
    trash: vi.fn(),
    restore: vi.fn(),
    permanentlyDeleteSelected: vi.fn(),
    emptyTrash: vi.fn()
  }
}));

const trashedPages: Page[] = ["Alpha", "Beta"].map((title, index) => ({
  id: `page-${index + 1}`,
  workspace_id: "workspace-1",
  parent_page_id: null,
  title,
  icon: null,
  cover_url: null,
  order_key: `a${index}`,
  is_archived: true,
  page_font: "default",
  page_width: "default",
  small_text: false,
  is_locked: false,
  is_favorite: false,
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z"
}));

function renderTrash() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TrashModal workspaceId="workspace-1" />
    </QueryClientProvider>
  );
}

describe("TrashModal", () => {
  beforeEach(() => {
    useEditorStore.setState({ trashOpen: true });
    vi.mocked(pagesApi.trash).mockResolvedValue(trashedPages);
    vi.mocked(pagesApi.restore).mockResolvedValue(trashedPages[0]);
    vi.mocked(pagesApi.permanentlyDeleteSelected).mockResolvedValue({ deleted_count: 1 });
    vi.mocked(pagesApi.emptyTrash).mockResolvedValue({ deleted_count: 2 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("permanently deletes only the selected pages after confirmation", async () => {
    renderTrash();
    await screen.findByText("Alpha");
    fireEvent.click(screen.getByLabelText("Select Alpha"));
    fireEvent.click(screen.getByText("Delete selected"));
    fireEvent.click(screen.getByText("Permanently delete"));

    await waitFor(() => {
      expect(pagesApi.permanentlyDeleteSelected).toHaveBeenCalledWith("workspace-1", ["page-1"]);
    });
    expect(pagesApi.emptyTrash).not.toHaveBeenCalled();
  });

  it("empties the entire workspace trash after confirmation", async () => {
    renderTrash();
    await screen.findByText("Beta");
    fireEvent.click(screen.getByText("Empty trash"));
    fireEvent.click(screen.getByText("Permanently delete"));

    await waitFor(() => expect(pagesApi.emptyTrash).toHaveBeenCalledWith("workspace-1"));
    expect(pagesApi.permanentlyDeleteSelected).not.toHaveBeenCalled();
  });
});
