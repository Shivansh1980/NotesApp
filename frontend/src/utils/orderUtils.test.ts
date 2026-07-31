import { describe, expect, it } from "vitest";

import {
  compareOrderKeys,
  createOrderKeyBetween,
  createOrderKeysBetween,
  hasNonIncreasingOrderKeys,
  reindexOrderKeys,
  sortByOrderKey
} from "./orderUtils";

describe("orderUtils", () => {
  it("creates stable keys between neighbors", () => {
    const middle = createOrderKeyBetween("a1", "a2");
    expect(["a2", middle, "a1"].sort(compareOrderKeys)).toEqual(["a1", middle, "a2"]);
  });

  it("sorts by order key and then creation time", () => {
    const sorted = sortByOrderKey([
      { id: "2", order_key: "a2", created_at: "2024-01-02" },
      { id: "1", order_key: "a1", created_at: "2024-01-01" }
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["1", "2"]);
  });

  it("sorts by the custom order-key alphabet instead of locale collation", () => {
    const sorted = sortByOrderKey([
      { id: "late", order_key: "yj" },
      { id: "early", order_key: "yU" }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["early", "late"]);
    expect(compareOrderKeys("yU", "yj")).toBeLessThan(0);
  });

  it("creates a batch of keys between two visible neighbors", () => {
    const keys = createOrderKeysBetween("b0", "c0", 3);

    expect(keys).toHaveLength(3);
    expect(compareOrderKeys("b0", keys[0])).toBeLessThan(0);
    expect(compareOrderKeys(keys[0], keys[1])).toBeLessThan(0);
    expect(compareOrderKeys(keys[1], keys[2])).toBeLessThan(0);
    expect(compareOrderKeys(keys[2], "c0")).toBeLessThan(0);
  });

  it("detects and repairs duplicate order keys so insertion can happen between siblings", () => {
    const siblings = [
      { id: "first", order_key: "a0" },
      { id: "second", order_key: "a0" },
      { id: "third", order_key: "a0" }
    ];

    expect(hasNonIncreasingOrderKeys(siblings)).toBe(true);

    const reindexed = reindexOrderKeys(siblings);
    const inserted = createOrderKeyBetween(reindexed[0].order_key, reindexed[1].order_key);

    expect(hasNonIncreasingOrderKeys(reindexed)).toBe(false);
    expect(compareOrderKeys(reindexed[0].order_key, inserted)).toBeLessThan(0);
    expect(compareOrderKeys(inserted, reindexed[1].order_key)).toBeLessThan(0);
  });
});
