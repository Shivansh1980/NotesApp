import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PageTreeNode } from "../../types/page.types";
import { PageTopBar } from "./PageTopBar";

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

describe("PageTopBar", () => {
  afterEach(cleanup);

  it("persists a selected page font", () => {
    const onUpdatePage = vi.fn();
    render(
      <PageTopBar
        breadcrumbs={[page]}
        currentPage={page}
        onSelectPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onTrashPage={vi.fn()}
        onCopyPageLink={vi.fn()}
        onOpenPageNewTab={vi.fn()}
        onUpdatePage={onUpdatePage}
      />
    );

    fireEvent.click(screen.getByLabelText("More page actions"));
    fireEvent.click(screen.getByText("Serif"));

    expect(onUpdatePage).toHaveBeenCalledWith(page, { page_font: "serif" });
  });

  it("highlights the page's persisted font", () => {
    render(
      <PageTopBar
        breadcrumbs={[page]}
        currentPage={{ ...page, page_font: "serif" }}
        onSelectPage={vi.fn()}
        onDuplicatePage={vi.fn()}
        onTrashPage={vi.fn()}
        onCopyPageLink={vi.fn()}
        onOpenPageNewTab={vi.fn()}
        onUpdatePage={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("More page actions"));
    expect(screen.getByText("Serif").closest("button")).toHaveClass("selected");
    expect(screen.getByText("Default").closest("button")).not.toHaveClass("selected");
  });
});
