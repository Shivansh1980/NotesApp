import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { blocksApi } from "../../api/blocks.api";
import { commentsApi } from "../../api/comments.api";
import { uploadsApi } from "../../api/uploads.api";
import { useAutosave } from "../../hooks/useAutosave";
import { useEditorKeyboard } from "../../hooks/useEditorKeyboard";
import { useEditorStore } from "../../store/editorStore";
import type { Block, BlockCreate, BlockType, BlockUpdate, PasteBlock } from "../../types/block.types";
import { blockText, cloneForCreate, emptyPropsForType, makeBlock, richText } from "../../utils/blockUtils";
import { markdownShortcutFor } from "../../utils/markdownUtils";
import {
  createOrderKeyBetween,
  createOrderKeysBetween,
  hasNonIncreasingOrderKeys,
  reindexOrderKeys,
  sortByOrderKey
} from "../../utils/orderUtils";
import { clipboardToBlocks, copyBlocksToClipboard } from "../../utils/pasteUtils";
import { planBlockHistorySync } from "../../utils/editorHistory";
import { BlockRenderer } from "./BlockRenderer";
import { FloatingToolbar } from "./FloatingToolbar";
import { SlashCommand, SlashCommandMenu } from "../menus/SlashCommandMenu";

type BlockEditorProps = {
  pageId: string;
  workspaceId: string | null;
  blocks: Block[];
  locked?: boolean;
};

function createOptimisticBlock(payload: BlockCreate): Block {
  const now = new Date().toISOString();
  return {
    id: `pending-${crypto.randomUUID()}`,
    page_id: payload.page_id,
    parent_block_id: payload.parent_block_id ?? null,
    type: payload.type,
    content: structuredClone(payload.content ?? []),
    props: structuredClone(payload.props ?? {}),
    order_key: payload.order_key,
    created_by: null,
    updated_by: null,
    created_at: now,
    updated_at: now,
    archived_at: null
  };
}

function pasteBlockToCreate(pageId: string, pasteBlock: PasteBlock, orderKey: string, parentBlockId: string | null): BlockCreate {
  const type = pasteBlock.type ?? "paragraph";
  return {
    page_id: pageId,
    parent_block_id: parentBlockId,
    type,
    content: structuredClone(pasteBlock.content ?? []),
    props: structuredClone({ ...emptyPropsForType(type), ...(pasteBlock.props ?? {}) }),
    order_key: orderKey
  };
}

function replaceBlocksById(current: Block[], replacements: Map<string, Block>): Block[] {
  return sortByOrderKey(current.map((block) => replacements.get(block.id) ?? block));
}

function focusEditableElement(target: HTMLElement, placement: "start" | "end" = "start") {
  target.focus();
  if (placement !== "end") return;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const end = target.value.length;
    target.setSelectionRange(end, end);
    return;
  }

  if (target.isContentEditable) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

export function BlockEditor({ pageId, workspaceId, blocks, locked = false }: BlockEditorProps) {
  const [localBlocks, setLocalBlocks] = useState<Block[]>([]);
  const [pendingPasteCount, setPendingPasteCount] = useState(0);
  const undoStack = useRef<Block[][]>([]);
  const redoStack = useRef<Block[][]>([]);
  const applyingHistory = useRef(false);
  const historyPageId = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const selectedBlockIds = useEditorStore((state) => state.selectedBlockIds);
  const setSelectedBlocks = useEditorStore((state) => state.setSelectedBlocks);
  const setFocusedBlock = useEditorStore((state) => state.setFocusedBlock);
  const searchTargetBlockId = useEditorStore((state) => state.searchTargetBlockId);
  const setSearchTargetBlock = useEditorStore((state) => state.setSearchTargetBlock);
  const slashMenu = useEditorStore((state) => state.slashMenu);
  const setSlashMenu = useEditorStore((state) => state.setSlashMenu);
  const { queueBlock, flush } = useAutosave((savedBlock) => {
    setLocalBlocks((current) => current.map((block) => (block.id === savedBlock.id ? savedBlock : block)));
    queryClient.setQueryData<Block[]>(["blocks", pageId], (current = []) =>
      current.map((block) => (block.id === savedBlock.id ? savedBlock : block))
    );
  });
  useEditorKeyboard({ save: flush });

  useEffect(() => {
    setLocalBlocks(sortByOrderKey(blocks));
    if (historyPageId.current !== pageId) {
      historyPageId.current = pageId;
      undoStack.current = [];
      redoStack.current = [];
    }
  }, [blocks, pageId]);

  const orderedBlocks = useMemo(() => sortByOrderKey(localBlocks), [localBlocks]);

  useEffect(() => {
    if (!searchTargetBlockId || !orderedBlocks.some((block) => block.id === searchTargetBlockId)) return;
    let clearTimer = 0;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-block-id="${searchTargetBlockId}"]`);
      if (!target) return;
      target.classList.add("search-target");
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      clearTimer = window.setTimeout(() => {
        target.classList.remove("search-target");
        setSearchTargetBlock(null);
      }, 2800);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [orderedBlocks, searchTargetBlockId, setSearchTargetBlock]);

  const cloneBlocks = useCallback((items: Block[]) => structuredClone(sortByOrderKey(items)), []);

  const remember = useCallback(
    (snapshot: Block[] = localBlocks) => {
      if (applyingHistory.current) return;
      undoStack.current.push(cloneBlocks(snapshot));
      if (undoStack.current.length > 200) undoStack.current.shift();
      redoStack.current = [];
    },
    [cloneBlocks, localBlocks]
  );

  const syncRestoredBlocks = useCallback(
    async (restored: Block[], currentSnapshot: Block[]) => {
      const { updates, restoreIds, removeIds } = planBlockHistorySync(restored, currentSnapshot);
      const restores = restoreIds.map((blockId) => blocksApi.restore(blockId));
      const removals = removeIds.map((blockId) => blocksApi.remove(blockId));
      await Promise.all([
        updates.length ? blocksApi.bulkUpdate(updates) : Promise.resolve([]),
        ...restores,
        ...removals
      ]);
      queryClient.invalidateQueries({ queryKey: ["blocks", pageId] });
    },
    [pageId, queryClient]
  );

  const restoreHistory = useCallback(
    (direction: "undo" | "redo") => {
      const source = direction === "undo" ? undoStack.current : redoStack.current;
      const target = direction === "undo" ? redoStack.current : undoStack.current;
      const restored = source.pop();
      if (!restored) return;
      const currentSnapshot = cloneBlocks(localBlocks);
      target.push(currentSnapshot);
      applyingHistory.current = true;
      setLocalBlocks(restored);
      queryClient.setQueryData<Block[]>(["blocks", pageId], restored);
      window.setTimeout(() => {
        applyingHistory.current = false;
      }, 0);
      void syncRestoredBlocks(restored, currentSnapshot);
    },
    [cloneBlocks, localBlocks, pageId, queryClient, syncRestoredBlocks]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (locked) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || !event.target || !(event.target instanceof Node)) return;
      if (!document.querySelector(".block-editor")?.contains(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory(event.shiftKey ? "redo" : "undo");
      }
      if (key === "y") {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory("redo");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [locked, restoreHistory]);

  const applyBlockPatch = useCallback(
    (block: Block, update: BlockUpdate) => {
      const next = { ...block, ...update, props: update.props ?? block.props, content: update.content ?? block.content };
      setLocalBlocks((current) => current.map((item) => (item.id === block.id ? next : item)));
      queueBlock(next, update);
      return next;
    },
    [queueBlock]
  );

  const patchBlock = useCallback(
    (block: Block, update: BlockUpdate) => {
      remember();
      applyBlockPatch(block, update);
    },
    [applyBlockPatch, remember]
  );

  const focusBlockById = useCallback(
    (blockId: string | null, placement: "start" | "end" = "start") => {
      if (!blockId) return;
      setFocusedBlock(blockId);
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-block-id="${blockId}"] .ProseMirror, [data-block-id="${blockId}"] textarea, [data-block-id="${blockId}"] .math-block, [data-block-id="${blockId}"] [tabindex]`
        );
        if (target) focusEditableElement(target, placement);
      });
    },
    [setFocusedBlock]
  );

  const createAfter = useCallback(
    async (afterBlock: Block | null, pasteBlock?: PasteBlock) => {
      remember();
      const sorted = sortByOrderKey(localBlocks);
      const parentBlockId = pasteBlock?.parent_block_id ?? null;
      let workingBlocks = sorted;
      let index = afterBlock ? workingBlocks.findIndex((block) => block.id === afterBlock.id) : workingBlocks.length - 1;

      if (hasNonIncreasingOrderKeys(workingBlocks)) {
        const reindexedBlocks = reindexOrderKeys(workingBlocks);
        const updates = reindexedBlocks
          .filter((block) => workingBlocks.find((item) => item.id === block.id)?.order_key !== block.order_key)
          .map((block) => ({ id: block.id, changes: { order_key: block.order_key } }));
        if (updates.length) await blocksApi.bulkUpdate(updates);
        workingBlocks = reindexedBlocks;
        index = afterBlock ? workingBlocks.findIndex((block) => block.id === afterBlock.id) : workingBlocks.length - 1;
      }

      const previous = index >= 0 ? workingBlocks[index] : null;
      const next = workingBlocks[index + 1] ?? null;
      const type = pasteBlock?.type ?? "paragraph";
      const payload = makeBlock(
        pageId,
        type,
        createOrderKeyBetween(previous?.order_key ?? null, next?.order_key ?? null),
        pasteBlock?.content ?? [],
        pasteBlock?.props ?? emptyPropsForType(type),
        parentBlockId
      );
      const created = await blocksApi.create(payload);
      const nextBlocks = sortByOrderKey([...workingBlocks, created]);
      setLocalBlocks(nextBlocks);
      queryClient.setQueryData<Block[]>(["blocks", pageId], nextBlocks);
      setFocusedBlock(created.id);
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-block-id="${created.id}"] .ProseMirror, [data-block-id="${created.id}"] textarea`
        );
        target?.focus();
      });
      return created;
    },
    [localBlocks, pageId, queryClient, remember, setFocusedBlock]
  );

  const insertPasteBlocks = useCallback(
    async (
      afterBlock: Block,
      pasteBlocks: PasteBlock[],
      options: { baseBlocks?: Block[]; rememberChange?: boolean; focusLast?: boolean } = {}
    ) => {
      const normalizedPasteBlocks = pasteBlocks.filter((block) => block.type);
      if (!normalizedPasteBlocks.length) return [];
      setPendingPasteCount((count) => count + normalizedPasteBlocks.length);
      if (options.rememberChange !== false) remember(options.baseBlocks ?? localBlocks);
      const optimisticIds = new Set<string>();
      try {
        const parentBlockId = null;
        const sorted = sortByOrderKey(options.baseBlocks ?? localBlocks);
        let workingBlocks = sorted;

        if (hasNonIncreasingOrderKeys(workingBlocks)) {
          const reindexedBlocks = reindexOrderKeys(workingBlocks);
          const updates = reindexedBlocks
            .filter((block) => workingBlocks.find((item) => item.id === block.id)?.order_key !== block.order_key)
            .map((block) => ({ id: block.id, changes: { order_key: block.order_key } }));
          if (updates.length) await blocksApi.bulkUpdate(updates);
          workingBlocks = reindexedBlocks;
        }

        const anchorIndex = workingBlocks.findIndex((block) => block.id === afterBlock.id);
        const anchor = anchorIndex >= 0 ? workingBlocks[anchorIndex] : afterBlock;
        const nextVisibleBlock = anchorIndex >= 0 ? workingBlocks[anchorIndex + 1] ?? null : null;
        const orderKeys = createOrderKeysBetween(
          anchor.order_key,
          nextVisibleBlock?.order_key ?? null,
          normalizedPasteBlocks.length
        );

        const payloads = normalizedPasteBlocks.map((pasteBlock, index) =>
          pasteBlockToCreate(pageId, pasteBlock, orderKeys[index], parentBlockId)
        );
        const optimisticBlocks = payloads.map(createOptimisticBlock);
        optimisticBlocks.forEach((block) => optimisticIds.add(block.id));
        workingBlocks = sortByOrderKey([...workingBlocks, ...optimisticBlocks]);

        setLocalBlocks(workingBlocks);
        queryClient.setQueryData<Block[]>(["blocks", pageId], workingBlocks);

        if (options.focusLast !== false && optimisticBlocks.length) {
          const lastOptimistic = optimisticBlocks[optimisticBlocks.length - 1];
          setFocusedBlock(lastOptimistic.id);
          window.requestAnimationFrame(() => {
            const target = document.querySelector<HTMLElement>(
              `[data-block-id="${lastOptimistic.id}"] .ProseMirror, [data-block-id="${lastOptimistic.id}"] textarea`
            );
            target?.focus();
          });
        }

        const createdBlocks = await Promise.all(payloads.map((payload) => blocksApi.create(payload)));
        const replacements = new Map<string, Block>();
        optimisticBlocks.forEach((optimisticBlock, index) => {
          replacements.set(optimisticBlock.id, createdBlocks[index]);
        });

        setLocalBlocks((current) => replaceBlocksById(current, replacements));
        queryClient.setQueryData<Block[]>(["blocks", pageId], (current = []) => {
          const savedIds = new Set(createdBlocks.map((block) => block.id));
          const withoutDuplicates = current.filter((block) => !optimisticIds.has(block.id) && !savedIds.has(block.id));
          return sortByOrderKey([...withoutDuplicates, ...createdBlocks]);
        });

        if (options.focusLast !== false && createdBlocks.length) {
          const lastCreated = createdBlocks[createdBlocks.length - 1];
          setFocusedBlock(lastCreated.id);
        }
        return createdBlocks;
      } catch (error) {
        setLocalBlocks((current) => current.filter((block) => !optimisticIds.has(block.id)));
        queryClient.invalidateQueries({ queryKey: ["blocks", pageId] });
        throw error;
      } finally {
        setPendingPasteCount((count) => Math.max(0, count - normalizedPasteBlocks.length));
      }
    },
    [localBlocks, pageId, queryClient, remember, setFocusedBlock]
  );

  const deleteBlock = async (block: Block, focusTargetId: string | null = null) => {
    remember();
    const snapshot = localBlocks;
    setLocalBlocks((current) => current.filter((item) => item.id !== block.id));
    queryClient.setQueryData<Block[]>(["blocks", pageId], (current = []) => current.filter((item) => item.id !== block.id));
    focusBlockById(focusTargetId, "end");
    try {
      await blocksApi.remove(block.id);
    } catch {
      setLocalBlocks(snapshot);
      queryClient.setQueryData<Block[]>(["blocks", pageId], snapshot);
    }
  };

  const duplicateBlock = async (block: Block) => {
    remember();
    const sorted = sortByOrderKey(localBlocks);
    const index = sorted.findIndex((item) => item.id === block.id);
    const next = sorted[index + 1] ?? null;
    const created = await blocksApi.create(cloneForCreate(pageId, block, createOrderKeyBetween(block.order_key, next?.order_key ?? null)));
    setLocalBlocks((current) => sortByOrderKey([...current, created]));
    queryClient.invalidateQueries({ queryKey: ["blocks", pageId] });
  };

  const copyBlock = async (block: Block) => {
    await copyBlocksToClipboard([{ type: block.type, content: block.content, props: block.props }]);
  };

  const copyBlockLink = async (block: Block) => {
    const url = new URL(window.location.href);
    url.hash = `block-${block.id}`;
    await navigator.clipboard.writeText(url.toString());
  };

  const addComment = async (block: Block) => {
    const text = window.prompt("Comment");
    if (!text?.trim()) return;
    await commentsApi.create(pageId, block.id, text.trim());
  };

  const moveBlock = async (block: Block, direction: -1 | 1) => {
    const sorted = sortByOrderKey(localBlocks);
    const index = sorted.findIndex((item) => item.id === block.id);
    const target = sorted[index + direction];
    if (!target) return;
    const before = direction < 0 ? sorted[index - 2] ?? null : target;
    const after = direction < 0 ? target : sorted[index + 2] ?? null;
    const orderKey = createOrderKeyBetween(before?.order_key ?? null, after?.order_key ?? null);
    remember();
    const updated = await blocksApi.reorder(block.id, block.parent_block_id, orderKey);
    setLocalBlocks((current) => sortByOrderKey(current.map((item) => (item.id === block.id ? updated : item))));
    queryClient.invalidateQueries({ queryKey: ["blocks", pageId] });
  };

  const selectBlock = (block: Block, multi: boolean) => {
    setSelectedBlocks(multi ? Array.from(new Set([...selectedBlockIds, block.id])) : [block.id]);
    setFocusedBlock(block.id);
  };

  const transformBlock = (block: Block, type: BlockType, content = block.content) => {
    const text = blockText(block);
    const props = { ...emptyPropsForType(type), indent: block.props.indent };
    const nextContent = type === "code" || type === "math" ? [] : content;
    if (type === "code") Object.assign(props, { code: text });
    if (type === "math") Object.assign(props, { latex: text });
    patchBlock(block, {
      type,
      content: nextContent,
      props
    });
  };

  const handleTextChange = (block: Block, text: string) => {
    const match = text.match(/(?:^|\s)\/([\w\s-]*)$/);
    if (!match) {
      if (slashMenu?.blockId === block.id) setSlashMenu(null);
      return;
    }
    const rect = window.getSelection()?.getRangeAt(0).getBoundingClientRect();
    setSlashMenu({
      blockId: block.id,
      query: match[1],
      x: rect ? rect.left : 420,
      y: rect ? rect.bottom + 8 : 220
    });
  };

  const applyCommand = async (command: SlashCommand) => {
    if (!slashMenu) return;
    const block = localBlocks.find((item) => item.id === slashMenu.blockId);
    if (!block || !command.type) return;
    const text = blockText(block).replace(/(?:^|\s)\/[\w\s-]*$/, "").trim();
    const content = text ? [richText(text)] : [];
    const props = emptyPropsForType(command.type);
    if (command.type === "image" || command.type === "file" || command.type === "bookmark") {
      const url = window.prompt("URL") ?? "";
      Object.assign(props, { url, fileName: url.split("/").pop() ?? "" });
    }
    patchBlock(block, { type: command.type, content, props });
    setSlashMenu(null);
  };

  const handleKeyDown = async (event: React.KeyboardEvent, block: Block) => {
    if (locked) return;
    const mod = event.ctrlKey || event.metaKey;
    const text = blockText(block);
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      restoreHistory(event.shiftKey ? "redo" : "undo");
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      restoreHistory("redo");
      return;
    }
    if (event.key === "Escape") {
      setSlashMenu(null);
      return;
    }
    if (event.key === " " && text.trim()) {
      const shortcut = markdownShortcutFor(text);
      if (shortcut) {
        event.preventDefault();
        transformBlock(block, shortcut.type, []);
        if (shortcut.checked) patchBlock(block, { props: { ...emptyPropsForType("todo"), checked: true } });
        return;
      }
    }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      await duplicateBlock(block);
      return;
    }
    if (mod && event.key === "Enter" && block.type === "todo") {
      event.preventDefault();
      patchBlock(block, { props: { ...block.props, checked: !block.props.checked } });
      return;
    }
    if (mod && event.shiftKey && event.key === "ArrowUp") {
      event.preventDefault();
      await moveBlock(block, -1);
      return;
    }
    if (mod && event.shiftKey && event.key === "ArrowDown") {
      event.preventDefault();
      await moveBlock(block, 1);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const current = Number(block.props.indent ?? 0);
      const next = event.shiftKey ? Math.max(current - 1, 0) : Math.min(current + 1, 6);
      patchBlock(block, { props: { ...block.props, indent: next } });
      return;
    }
    if (event.key === "Backspace" && !text && orderedBlocks.length > 1) {
      event.preventDefault();
      const index = orderedBlocks.findIndex((item) => item.id === block.id);
      const target = orderedBlocks[index - 1] ?? orderedBlocks[index + 1] ?? null;
      await deleteBlock(block, target?.id ?? null);
      return;
    }
    if (event.key === "Backspace" && !text && block.type !== "paragraph") {
      event.preventDefault();
      transformBlock(block, "paragraph", []);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
      event.preventDefault();
      const nextType =
        block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3"
          ? "paragraph"
          : block.type === "quote"
            ? "quote"
            : block.type === "todo" || block.type === "bulleted_list" || block.type === "numbered_list"
              ? block.type
              : "paragraph";
      if (!text && ["todo", "bulleted_list", "numbered_list"].includes(block.type)) {
        transformBlock(block, "paragraph", []);
        return;
      }
      await createAfter(block, { type: nextType, content: [], props: emptyPropsForType(nextType) });
    }
  };

  const handlePasteForBlock = async (event: React.ClipboardEvent, block: Block) => {
    if (locked) return;
    if (block.type === "code") return;
    event.preventDefault();
    setPendingPasteCount((count) => count + 1);
    try {
      const pasteBlocks = await clipboardToBlocks(event.clipboardData, async (file) => {
        if (!workspaceId) throw new Error("Workspace is required for uploads");
        const upload = await uploadsApi.upload(workspaceId, file);
        return { url: upload.public_url, fileName: upload.file_name, fileType: upload.file_type };
      });
      if (!pasteBlocks.length) return;
      if (!blockText(block).trim()) {
        const [firstBlock, ...rest] = pasteBlocks;
        remember();
        let updatedBlock = block;
        if (firstBlock) {
          updatedBlock = applyBlockPatch(block, {
            type: firstBlock.type,
            content: firstBlock.content ?? [],
            props: { ...emptyPropsForType(firstBlock.type), ...(firstBlock.props ?? {}) }
          });
        }
        if (rest.length) {
          const baseBlocks = localBlocks.map((item) => (item.id === updatedBlock.id ? updatedBlock : item));
          await insertPasteBlocks(updatedBlock, rest, { baseBlocks, rememberChange: false, focusLast: false });
        }
        return;
      }
      await insertPasteBlocks(block, pasteBlocks, { focusLast: false });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["blocks", pageId] });
    } finally {
      setPendingPasteCount((count) => Math.max(0, count - 1));
    }
  };

  const pasteIndicator =
    pendingPasteCount > 0 ? (
      <div className="paste-progress" role="status" aria-live="polite">
        <span className="paste-progress-spinner" aria-hidden="true" />
        Pasting blocks...
      </div>
    ) : null;

  useEffect(() => {
    const importBlocks = (event: Event) => {
      if (locked) return;
      const detail = (event as CustomEvent<{ pageId: string; blocks: PasteBlock[] }>).detail;
      if (!detail || detail.pageId !== pageId || !Array.isArray(detail.blocks) || !detail.blocks.length) return;
      const anchor = orderedBlocks[orderedBlocks.length - 1];
      if (anchor) void insertPasteBlocks(anchor, detail.blocks, { focusLast: false });
    };
    window.addEventListener("notes:import-blocks", importBlocks);
    return () => window.removeEventListener("notes:import-blocks", importBlocks);
  }, [insertPasteBlocks, locked, orderedBlocks, pageId]);

  if (!orderedBlocks.length) {
    return (
      <div className="empty-editor">
        {pasteIndicator}
        <button className="primary-button" type="button" onClick={() => void createAfter(null)}>
          New block
        </button>
      </div>
    );
  }

  return (
    <section className={`block-editor ${locked ? "locked" : ""}`} aria-readonly={locked}>
      {pasteIndicator}
      <FloatingToolbar />
      {orderedBlocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          selected={selectedBlockIds.includes(block.id)}
          readOnly={locked}
          onChange={patchBlock}
          onAddAfter={(item) => void createAfter(item)}
          onDelete={(item) => void deleteBlock(item)}
          onDuplicate={(item) => void duplicateBlock(item)}
          onCopy={(item) => void copyBlock(item)}
          onCopyLink={(item) => void copyBlockLink(item)}
          onComment={(item) => void addComment(item)}
          onMove={(item, direction) => void moveBlock(item, direction)}
          onTransform={transformBlock}
          onKeyDown={(event, item) => void handleKeyDown(event, item)}
          onPaste={(event, item) => void handlePasteForBlock(event, item)}
          onFocus={setFocusedBlock}
          onTextChange={handleTextChange}
          onSelect={selectBlock}
        />
      ))}
      {slashMenu ? (
        <SlashCommandMenu query={slashMenu.query} x={slashMenu.x} y={slashMenu.y} onSelect={(command) => void applyCommand(command)} />
      ) : null}
    </section>
  );
}
