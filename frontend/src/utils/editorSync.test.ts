import { describe, expect, it } from "vitest";

import { shouldSyncEditorContent } from "./editorSync";

describe("editorSync", () => {
  it("syncs when the active block changes", () => {
    expect(
      shouldSyncEditorContent({
        blockIdChanged: true,
        currentHtml: "<p>Current</p>",
        incomingHtml: "<p>Next</p>"
      })
    ).toBe(true);
  });

  it("skips redundant content resets", () => {
    expect(
      shouldSyncEditorContent({
        blockIdChanged: false,
        currentHtml: "<p>Same</p>",
        incomingHtml: "<p>Same</p>"
      })
    ).toBe(false);
  });

  it("syncs external changes such as undo snapshots", () => {
    expect(
      shouldSyncEditorContent({
        blockIdChanged: false,
        currentHtml: "<p>Current</p>",
        incomingHtml: "<p>Previous</p>"
      })
    ).toBe(true);
  });
});
