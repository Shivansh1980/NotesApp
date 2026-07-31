import { afterEach, describe, expect, it } from "vitest";

import { createExportSnapshot } from "./exportUtils";

describe("exportUtils", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("captures a clean page snapshot for export", () => {
    document.body.innerHTML = `
      <section class="editor-page">
        <header class="page-header">
          <input class="page-title-input" value="Export Me" />
          <div class="save-status">saved</div>
        </header>
        <div class="block-row block-heading_1"><div class="block-content">Heading</div><div class="block-actions">controls</div></div>
        <div class="block-row block-divider"><div class="divider-block"></div></div>
        <div class="block-row block-code"><pre class="code-highlight">const x = 1;</pre><textarea>const x = 1;</textarea></div>
      </section>
    `;

    const snapshot = createExportSnapshot();

    expect(snapshot.title).toBe("Export Me");
    expect(snapshot.blocks.map((block) => block.type)).toEqual(["heading_1", "divider", "code"]);
    expect(snapshot.html).not.toContain("block-actions");
    expect(snapshot.html).not.toContain("textarea");
  });
});
