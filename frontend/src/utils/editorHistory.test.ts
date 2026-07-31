import { describe, expect, it } from "vitest";

import type { Block } from "../types/block.types";
import { planBlockHistorySync } from "./editorHistory";

const baseBlock = (overrides: Partial<Block>): Block => ({
  id: "block-a",
  page_id: "page-a",
  parent_block_id: null,
  type: "paragraph",
  content: [
    {
      text: "hello",
      marks: {
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        code: false,
        color: "default",
        backgroundColor: "default",
        link: null
      }
    }
  ],
  props: {},
  order_key: "a0",
  created_by: null,
  updated_by: null,
  created_at: "2026-05-23T00:00:00Z",
  updated_at: "2026-05-23T00:00:00Z",
  archived_at: null,
  ...overrides
});

describe("editorHistory", () => {
  it("plans updates for edited or moved blocks", () => {
    const current = baseBlock({ props: { indent: 1 }, order_key: "a0" });
    const restored = baseBlock({ props: { indent: 0 }, order_key: "a1", type: "heading_2" });

    expect(planBlockHistorySync([restored], [current])).toEqual({
      updates: [
        {
          id: "block-a",
          changes: {
            type: "heading_2",
            content: restored.content,
            props: { indent: 0 },
            parent_block_id: null,
            order_key: "a1"
          }
        }
      ],
      restoreIds: [],
      removeIds: []
    });
  });

  it("restores missing snapshot blocks and removes blocks created after the snapshot", () => {
    const restored = [baseBlock({ id: "restored-block" })];
    const current = [baseBlock({ id: "new-block" })];

    expect(planBlockHistorySync(restored, current)).toEqual({
      updates: [],
      restoreIds: ["restored-block"],
      removeIds: ["new-block"]
    });
  });
});
