import { describe, expect, it } from "vitest";

import { markdownShortcutFor, markdownToBlocks } from "./markdownUtils";

describe("markdownUtils", () => {
  it("maps typed shortcuts to block types", () => {
    expect(markdownShortcutFor("##")).toEqual({ type: "heading_2" });
    expect(markdownShortcutFor("[x]")).toEqual({ type: "todo", checked: true });
  });

  it("converts markdown into block records", () => {
    const blocks = markdownToBlocks("# Title\n- Item\n```ts\nconst x = 1;\n```");
    expect(blocks.map((block) => block.type)).toEqual(["heading_1", "bulleted_list", "code"]);
    expect((blocks[2]?.props ?? {}).code).toBe("const x = 1;");
  });
});
