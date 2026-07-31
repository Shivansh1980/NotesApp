type EditorSyncInput = {
  blockIdChanged: boolean;
  currentHtml: string;
  incomingHtml: string;
};

export function shouldSyncEditorContent({ blockIdChanged, currentHtml, incomingHtml }: EditorSyncInput): boolean {
  return blockIdChanged || currentHtml !== incomingHtml;
}
