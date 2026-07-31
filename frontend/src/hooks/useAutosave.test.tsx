import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blocksApi } from "../api/blocks.api";
import type { Block } from "../types/block.types";
import { richText } from "../utils/blockUtils";
import { useAutosave } from "./useAutosave";

vi.mock("../api/blocks.api", () => ({
  blocksApi: {
    update: vi.fn()
  }
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function blockWithText(text: string): Block {
  return {
    id: "block-1",
    page_id: "page-1",
    parent_block_id: null,
    type: "paragraph",
    content: [richText(text)],
    props: { html: `<p>${text}</p>` },
    order_key: "a1",
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    archived_at: null
  };
}

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    vi.mocked(blocksApi.update).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not apply stale save responses over newer local typing", async () => {
    const saves: Deferred<Block>[] = [];
    vi.mocked(blocksApi.update).mockImplementation(() => {
      const save = deferred<Block>();
      saves.push(save);
      return save.promise;
    });

    const onSaved = vi.fn();
    const { result, unmount } = renderHook(() => useAutosave(onSaved));
    const firstEdit = blockWithText("dog");
    const secondEdit = blockWithText("dog, airplane, democracy");

    act(() => {
      result.current.queueBlock(firstEdit, {
        content: firstEdit.content,
        props: firstEdit.props
      });
      vi.advanceTimersByTime(700);
    });
    expect(blocksApi.update).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.queueBlock(secondEdit, {
        content: secondEdit.content,
        props: secondEdit.props
      });
      vi.advanceTimersByTime(700);
    });
    expect(blocksApi.update).toHaveBeenCalledTimes(2);

    await act(async () => {
      saves[1]?.resolve(secondEdit);
      await settlePromises();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenLastCalledWith(secondEdit);

    await act(async () => {
      saves[0]?.resolve(firstEdit);
      await settlePromises();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    unmount();
  });
});
