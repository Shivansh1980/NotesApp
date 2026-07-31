import { request } from "./client";
import type { Block, BlockCreate, BlockUpdate } from "../types/block.types";

export const blocksApi = {
  list(pageId: string) {
    return request<Block[]>(`/api/pages/${pageId}/blocks`);
  },
  create(payload: BlockCreate) {
    return request<Block>("/api/blocks", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  update(blockId: string, payload: BlockUpdate) {
    return request<Block>(`/api/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  },
  remove(blockId: string) {
    return request<void>(`/api/blocks/${blockId}`, { method: "DELETE" });
  },
  restore(blockId: string) {
    return request<Block>(`/api/blocks/${blockId}/restore`, { method: "POST" });
  },
  bulkUpdate(blocks: { id: string; changes: BlockUpdate }[]) {
    return request<Block[]>("/api/blocks/bulk-update", {
      method: "POST",
      body: JSON.stringify({ blocks })
    });
  },
  reorder(blockId: string, parentBlockId: string | null, orderKey: string) {
    return request<Block>("/api/blocks/reorder", {
      method: "POST",
      body: JSON.stringify({
        block_id: blockId,
        parent_block_id: parentBlockId,
        order_key: orderKey
      })
    });
  },
  duplicate(blockId: string) {
    return request<Block>("/api/blocks/duplicate", {
      method: "POST",
      body: JSON.stringify({ block_id: blockId })
    });
  },
  move(blockId: string, pageId: string | null, parentBlockId: string | null, orderKey: string) {
    return request<Block>("/api/blocks/move", {
      method: "POST",
      body: JSON.stringify({
        block_id: blockId,
        page_id: pageId,
        parent_block_id: parentBlockId,
        order_key: orderKey
      })
    });
  }
};
