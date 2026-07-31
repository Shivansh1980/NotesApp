import type { Block, BlockUpdate } from "../types/block.types";

type HistoryComparableBlock = Pick<Block, "type" | "content" | "props" | "parent_block_id" | "order_key">;

export type BlockHistorySyncPlan = {
  updates: Array<{ id: string; changes: BlockUpdate }>;
  restoreIds: string[];
  removeIds: string[];
};

function comparableBlock(block: Block): HistoryComparableBlock {
  return {
    type: block.type,
    content: block.content,
    props: block.props,
    parent_block_id: block.parent_block_id,
    order_key: block.order_key
  };
}

function didBlockChange(current: Block, restored: Block): boolean {
  return JSON.stringify(comparableBlock(current)) !== JSON.stringify(comparableBlock(restored));
}

export function planBlockHistorySync(restored: Block[], currentSnapshot: Block[]): BlockHistorySyncPlan {
  const currentById = new Map(currentSnapshot.map((block) => [block.id, block]));
  const restoredById = new Map(restored.map((block) => [block.id, block]));
  const updates = restored
    .filter((block) => {
      const current = currentById.get(block.id);
      return current ? didBlockChange(current, block) : false;
    })
    .map((block) => ({
      id: block.id,
      changes: comparableBlock(block)
    }));

  return {
    updates,
    restoreIds: restored.filter((block) => !currentById.has(block.id)).map((block) => block.id),
    removeIds: currentSnapshot.filter((block) => !restoredById.has(block.id)).map((block) => block.id)
  };
}
