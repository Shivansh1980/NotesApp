import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Block } from "../../types/block.types";
import { richText } from "../../utils/blockUtils";
import { MathBlock } from "./MathBlock";

function makeMathBlock(): Block {
  return {
    id: "math-1",
    page_id: "page-1",
    parent_block_id: null,
    type: "math",
    content: [richText("t_i \\to E[t_i] = x_i")],
    props: { latex: "t_i \\to E[t_i] = x_i" },
    order_key: "a0",
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null
  };
}

describe("MathBlock", () => {
  it("turns rendered math into an inline source editor on click and renders again on blur", () => {
    const { container } = render(<MathBlock block={makeMathBlock()} onChange={vi.fn()} onKeyDown={vi.fn()} onFocus={vi.fn()} />);
    const block = container.querySelector(".math-block");

    expect(container.querySelector(".math-render .katex")).toBeTruthy();
    expect(screen.queryByLabelText("Equation")).not.toBeInTheDocument();

    fireEvent.click(block as Element);

    const editor = screen.getByLabelText("Equation");
    expect(editor).toBeInTheDocument();
    expect(container.querySelector(".math-render")).not.toBeInTheDocument();

    fireEvent.blur(editor);

    expect(screen.queryByLabelText("Equation")).not.toBeInTheDocument();
    expect(container.querySelector(".math-render .katex")).toBeTruthy();
  });

  it("marks the math block as focused when the rendered equation is clicked", () => {
    const onFocus = vi.fn();
    const { container } = render(<MathBlock block={makeMathBlock()} onChange={vi.fn()} onKeyDown={vi.fn()} onFocus={onFocus} />);
    const block = container.querySelector(".math-block");

    fireEvent.mouseDown(block as Element);

    expect(onFocus).toHaveBeenCalledWith("math-1");
  });
});
