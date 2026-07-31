import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PageTreeNode } from "../../types/page.types";
import { PageTree } from "./PageTree";

const page: PageTreeNode = {
  id: "page-1",
  workspace_id: "workspace-1",
  parent_page_id: null,
  title: "Temporary",
  icon: null,
  cover_url: null,
  order_key: "a1",
  is_archived: false,
  page_font: "default",
  page_width: "default",
  small_text: false,
  is_locked: false,
  is_favorite: false,
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  children: []
};

describe("PageTree", () => {
  it("opens page actions and dispatches trash actions", () => {
    const onTrashPage = vi.fn();
    render(
      <PageTree
        pages={[page]}
        currentPageId={page.id}
        onSelectPage={vi.fn()}
        onCreatePage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onRenamePage={vi.fn()}
        onTrashPage={onTrashPage}
        onMovePage={vi.fn()}
        onCopyPageLink={vi.fn()}
        onOpenPageNewTab={vi.fn()}
        onUpdatePage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("Page actions"));
    fireEvent.click(screen.getByText("Move to Trash"));

    expect(onTrashPage).toHaveBeenCalledWith(page);
  });
});
