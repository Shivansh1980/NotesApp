import { useCallback } from "react";

import { uploadsApi } from "../api/uploads.api";
import type { PasteBlock } from "../types/block.types";
import { clipboardToBlocks } from "../utils/pasteUtils";

export function usePasteHandler(workspaceId: string | null, onBlocks: (blocks: PasteBlock[]) => Promise<void>) {
  return useCallback(
    async (event: React.ClipboardEvent) => {
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      event.preventDefault();
      const blocks = await clipboardToBlocks(clipboard, async (file) => {
        if (!workspaceId) throw new Error("Workspace is required for uploads");
        const upload = await uploadsApi.upload(workspaceId, file);
        return { url: upload.public_url, fileName: upload.file_name, fileType: upload.file_type };
      });
      if (blocks.length) await onBlocks(blocks);
    },
    [onBlocks, workspaceId]
  );
}
