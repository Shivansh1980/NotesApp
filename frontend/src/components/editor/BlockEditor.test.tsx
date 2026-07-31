import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blocksApi } from "../../api/blocks.api";
import type { Block, BlockCreate, BlockType, BlockUpdate } from "../../types/block.types";
import { richText } from "../../utils/blockUtils";
import { compareOrderKeys } from "../../utils/orderUtils";
import { BlockEditor } from "./BlockEditor";

vi.mock("../../hooks/useAutosave", () => ({
  useAutosave: () => ({
    queueBlock: vi.fn(),
    flush: vi.fn()
  })
}));

vi.mock("../../api/blocks.api", () => ({
  blocksApi: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    restore: vi.fn(),
    bulkUpdate: vi.fn(),
    reorder: vi.fn(),
    duplicate: vi.fn(),
    move: vi.fn()
  }
}));

vi.mock("../../api/comments.api", () => ({
  commentsApi: {
    create: vi.fn()
  }
}));

vi.mock("../../api/uploads.api", () => ({
  uploadsApi: {
    upload: vi.fn()
  }
}));

vi.mock("./FloatingToolbar", () => ({
  FloatingToolbar: () => null
}));

vi.mock("./RichTextEditable", () => ({
  RichTextEditable: ({
    block,
    onPaste,
    onKeyDown
  }: {
    block: Block;
    onPaste: (event: React.ClipboardEvent, block: Block) => void;
    onKeyDown: (event: React.KeyboardEvent, block: Block) => void;
  }) => {
    const value =
      block.type === "code"
        ? String(block.props.code ?? "")
        : block.type === "math"
          ? String(block.props.latex ?? "")
          : block.content.map((item) => item.text).join("");

    return (
      <textarea
        aria-label={`block-${block.id}`}
        readOnly
        value={value}
        onPaste={(event) => onPaste(event, block)}
        onKeyDown={(event) => onKeyDown(event, block)}
      />
    );
  }
}));

function makeTestBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "source",
    page_id: "page-1",
    parent_block_id: null,
    type: "paragraph",
    content: [],
    props: {},
    order_key: "a0",
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null,
    ...overrides
  };
}

function clipboardWithText(text: string): DataTransfer {
  return {
    files: [] as unknown as FileList,
    getData: vi.fn((type: string) => (type === "text/plain" ? text : ""))
  } as unknown as DataTransfer;
}

function clipboardWithHtmlAndText(html: string, text: string): DataTransfer {
  return {
    files: [] as unknown as FileList,
    getData: vi.fn((type: string) => {
      if (type === "text/html") return html;
      if (type === "text/plain") return text;
      return "";
    })
  } as unknown as DataTransfer;
}

function renderEditor(blocks: Block[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BlockEditor pageId="page-1" workspaceId="workspace-1" blocks={blocks} />
    </QueryClientProvider>
  );
}

function renderEditorWithServerSync(blocks: Block[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <BlockEditor pageId="page-1" workspaceId="workspace-1" blocks={blocks} />
    </QueryClientProvider>
  );

  return {
    ...view,
    syncBlocks(nextBlocks: Block[]) {
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <BlockEditor pageId="page-1" workspaceId="workspace-1" blocks={nextBlocks} />
        </QueryClientProvider>
      );
    }
  };
}

describe("BlockEditor paste", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    let createdIndex = 0;
    vi.mocked(blocksApi.create).mockImplementation(async (payload: BlockCreate) =>
      makeTestBlock({
        id: `created-${++createdIndex}`,
        page_id: payload.page_id,
        parent_block_id: payload.parent_block_id ?? null,
        type: (payload.type ?? "paragraph") as BlockType,
        content: payload.content ?? [],
        props: payload.props ?? {},
        order_key: payload.order_key
      })
    );
    vi.mocked(blocksApi.bulkUpdate).mockResolvedValue([]);
    vi.mocked(blocksApi.remove).mockResolvedValue(undefined);
    vi.mocked(blocksApi.update).mockImplementation(async (blockId: string, payload: BlockUpdate) =>
      makeTestBlock({ id: blockId, ...payload })
    );
  });

  it("pastes multiline text into an empty block without replacing earlier lines", async () => {
    renderEditor([makeTestBlock({ id: "source", content: [] })]);

    const editor = await screen.findByLabelText("block-source");
    fireEvent.paste(editor, {
      clipboardData: clipboardWithText(`8. Step-by-step pipeline

Suppose input is:

The dog barked
Step 1: Tokenization
["The", "dog", "barked"]
Step 2: Convert tokens to IDs
vectors -> attention -> feed-forward layers -> final contextual vectors`)
    });

    await waitFor(() => expect(blocksApi.create).toHaveBeenCalledTimes(6));

    expect(screen.getByDisplayValue("8. Step-by-step pipeline")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Suppose input is:")).toBeInTheDocument();
    expect(screen.getByDisplayValue("The dog barked")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Step 1: Tokenization")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("vectors -> attention -> feed-forward layers -> final contextual vectors")
    ).toBeInTheDocument();

    expect(vi.mocked(blocksApi.create).mock.calls.map(([payload]) => payload.content?.[0]?.text)).toEqual([
      "Suppose input is:",
      "The dog barked",
      "Step 1: Tokenization",
      "[\"The\", \"dog\", \"barked\"]",
      "Step 2: Convert tokens to IDs",
      "vectors -> attention -> feed-forward layers -> final contextual vectors"
    ]);
  });

  it("renders pasted blocks immediately while backend creation is still pending", async () => {
    vi.mocked(blocksApi.create).mockImplementation(() => new Promise<Block>(() => {}));
    renderEditor([makeTestBlock({ id: "source", content: [richText("Before")] })]);

    const editor = await screen.findByLabelText("block-source");
    fireEvent.paste(editor, {
      clipboardData: clipboardWithText(`First pasted line
Second pasted line
Third pasted line`)
    });

    expect(await screen.findByText("Pasting blocks...")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("First pasted line")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Second pasted line")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Third pasted line")).toBeInTheDocument();
  });

  it("pastes rich ChatGPT math/code content in visible clipboard order", async () => {
    renderEditor([makeTestBlock({ id: "source", content: [] })]);

    const editor = await screen.findByLabelText("block-source");
    fireEvent.paste(editor, {
      clipboardData: clipboardWithHtmlAndText(
        `
          <main>
            <h1>Part 1: Temperature, top-k, and top-p</h1>
            <h2>1. The model first creates scores</h2>
            <p>Suppose prompt is:</p>
            <pre>The capital of France is</pre>
            <p>The model produces raw scores, called logits:</p>
            <pre>Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0</pre>
            <span class="katex-display">
              <span class="katex">
                <math display="block">
                  <semantics>
                    <annotation encoding="application/x-tex">P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}</annotation>
                  </semantics>
                </math>
              </span>
            </span>
            <pre>z_i = score/logit for token i
P_i = probability of token i</pre>
            <p>So the model gets something like:</p>
            <p>where:</p>
            <p>Then softmax converts them into probabilities:</p>
          </main>
        `,
        `Part 1: Temperature, top-k, and top-p

1. The model first creates scores

Suppose prompt is:

The capital of France is

The model produces raw scores, called logits:

Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0

Then softmax converts them into probabilities:

P_i = e^{z_i} / sum_j e^{z_j}

where:

z_i = score/logit for token i
P_i = probability of token i

So the model gets something like:`
      )
    });

    await waitFor(() => expect(blocksApi.create).toHaveBeenCalledTimes(10));

    expect(screen.getByDisplayValue("Part 1: Temperature, top-k, and top-p")).toBeInTheDocument();
    expect(vi.mocked(blocksApi.create).mock.calls.map(([payload]) => payload.type)).toEqual([
      "heading_2",
      "paragraph",
      "code",
      "paragraph",
      "code",
      "math",
      "code",
      "paragraph",
      "paragraph",
      "paragraph"
    ]);
    expect(
      vi.mocked(blocksApi.create).mock.calls.map(([payload]) =>
        String(payload.props?.latex ?? payload.props?.code ?? payload.content?.[0]?.text ?? "")
      )
    ).toEqual([
      "1. The model first creates scores",
      "Suppose prompt is:",
      "The capital of France is",
      "The model produces raw scores, called logits:",
      "Paris        8.0\nLondon       3.0\nBerlin       2.5\nbanana      -1.0",
      "P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}",
      "z_i = score/logit for token i\nP_i = probability of token i",
      "So the model gets something like:",
      "where:",
      "Then softmax converts them into probabilities:"
    ]);
  });

  it("keeps the paste transaction undoable after saved blocks synchronize from the server", async () => {
    const source = makeTestBlock({ id: "source", content: [] });
    const view = renderEditorWithServerSync([source]);

    const editor = await screen.findByLabelText("block-source");
    fireEvent.paste(editor, {
      clipboardData: clipboardWithText(`First line
Second line
Third line`)
    });

    await waitFor(() => expect(blocksApi.create).toHaveBeenCalledTimes(2));

    const created = vi.mocked(blocksApi.create).mock.results.map((result) => result.value);
    const savedBlocks = await Promise.all(created);
    view.syncBlocks([
      makeTestBlock({ id: "source", content: [richText("First line")], order_key: "a0" }),
      ...savedBlocks
    ]);

    await waitFor(() => expect(screen.getByDisplayValue("Third line")).toBeInTheDocument());
    fireEvent.keyDown(screen.getByLabelText("block-source"), { key: "z", ctrlKey: true });

    await waitFor(() => expect(screen.getByLabelText("block-source")).toHaveValue(""));
    expect(screen.queryByDisplayValue("Second line")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Third line")).not.toBeInTheDocument();
    await waitFor(() => expect(blocksApi.remove).toHaveBeenCalledTimes(2));
  });

  it("focuses the previous block after deleting an empty block with Backspace", async () => {
    renderEditor([
      makeTestBlock({ id: "first", content: [richText("Previous text")], order_key: "a0" }),
      makeTestBlock({ id: "second", content: [], order_key: "b0" })
    ]);

    const second = await screen.findByLabelText("block-second");
    fireEvent.keyDown(second, { key: "Backspace" });

    await waitFor(() => expect(blocksApi.remove).toHaveBeenCalledWith("second"));
    const first = screen.getByLabelText("block-first") as HTMLTextAreaElement;
    await waitFor(() => expect(first).toHaveFocus());
    expect(first.selectionStart).toBe("Previous text".length);
    expect(first.selectionEnd).toBe("Previous text".length);
  });

  it("deletes an empty code block and focuses the previous block with Backspace", async () => {
    const view = renderEditor([
      makeTestBlock({ id: "first", content: [richText("Previous text")], order_key: "a0" }),
      makeTestBlock({ id: "code", type: "code", content: [], props: { code: "" }, order_key: "b0" })
    ]);

    const codeEditor = view.container.querySelector(".code-block textarea") as HTMLTextAreaElement;
    fireEvent.keyDown(codeEditor, { key: "Backspace" });

    await waitFor(() => expect(blocksApi.remove).toHaveBeenCalledWith("code"));
    const first = screen.getByLabelText("block-first") as HTMLTextAreaElement;
    await waitFor(() => expect(first).toHaveFocus());
    expect(first.selectionStart).toBe("Previous text".length);
  });

  it("adds a block directly after the visible block even when the next block has a different parent", async () => {
    renderEditor([
      makeTestBlock({
        id: "code",
        parent_block_id: "legacy-parent",
        type: "code",
        content: [],
        props: { code: "Paris 8.0" },
        order_key: "b0"
      }),
      makeTestBlock({
        id: "math",
        parent_block_id: "legacy-parent",
        type: "math",
        content: [richText("P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}")],
        props: { latex: "P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}" },
        order_key: "c0"
      })
    ]);

    fireEvent.click(screen.getAllByLabelText("Add block below")[0]);

    await waitFor(() => expect(blocksApi.create).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(blocksApi.create).mock.calls[0][0];

    expect(payload.type).toBe("paragraph");
    expect(payload.parent_block_id).toBeNull();
    expect(compareOrderKeys(payload.order_key, "b0")).toBeGreaterThan(0);
    expect(compareOrderKeys(payload.order_key, "c0")).toBeLessThan(0);
  });
});
