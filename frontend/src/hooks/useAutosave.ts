import { useCallback, useEffect, useRef } from "react";

import { blocksApi } from "../api/blocks.api";
import { useEditorStore } from "../store/editorStore";
import type { Block, BlockUpdate } from "../types/block.types";

type SavePayload = {
  block: Block;
  update: BlockUpdate;
  revision: number;
};

export function useAutosave(onSaved: (block: Block) => void) {
  const queue = useRef(new Map<string, SavePayload>());
  const timer = useRef<number | null>(null);
  const revisions = useRef(new Map<string, number>());
  const inFlight = useRef(0);
  const setSaveStatus = useEditorStore((state) => state.setSaveStatus);

  const flush = useCallback(async () => {
    const pending = Array.from(queue.current.values());
    queue.current.clear();
    if (!pending.length) return;

    if (!navigator.onLine) {
      pending.forEach((item) => {
        if (!queue.current.has(item.block.id)) queue.current.set(item.block.id, item);
      });
      setSaveStatus("offline");
      return;
    }

    setSaveStatus("saving");
    inFlight.current += pending.length;
    let failedLatestSave = false;
    try {
      const saved = await Promise.all(
        pending.map(async (item) => ({
          item,
          block: await blocksApi.update(item.block.id, item.update)
        }))
      );
      saved.forEach(({ item, block }) => {
        const latestRevision = revisions.current.get(item.block.id);
        if (latestRevision === item.revision && !queue.current.has(item.block.id)) {
          onSaved(block);
        }
      });
      setSaveStatus(queue.current.size || inFlight.current > pending.length ? "saving" : "saved");
    } catch {
      pending.forEach((item) => {
        const latestRevision = revisions.current.get(item.block.id);
        if (latestRevision === item.revision && !queue.current.has(item.block.id)) {
          queue.current.set(item.block.id, item);
          failedLatestSave = true;
        }
      });
      if (failedLatestSave) setSaveStatus("failed");
    } finally {
      inFlight.current = Math.max(0, inFlight.current - pending.length);
      if (!failedLatestSave) setSaveStatus(queue.current.size || inFlight.current ? "saving" : "saved");
    }
  }, [onSaved, setSaveStatus]);

  const queueBlock = useCallback(
    (block: Block, update: BlockUpdate) => {
      const revision = (revisions.current.get(block.id) ?? 0) + 1;
      revisions.current.set(block.id, revision);
      queue.current.set(block.id, { block, update, revision });
      setSaveStatus("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 700);
    },
    [flush, setSaveStatus]
  );

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  return { queueBlock, flush };
}
