const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const RANKS = new Map(Array.from(ALPHABET).map((character, index) => [character, index]));

function rank(char: string | undefined, fallback: number): number {
  if (!char) return fallback;
  return RANKS.get(char) ?? fallback;
}

function sortRank(char: string): number {
  return RANKS.get(char) ?? ALPHABET.length + (char.codePointAt(0) ?? 0);
}

function compareOptionalString(left: string | null | undefined, right: string | null | undefined): number {
  if (left === right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left < right ? -1 : 1;
}

export function compareOrderKeys(left: string, right: string): number {
  if (left === right) return 0;

  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = sortRank(left[index]) - sortRank(right[index]);
    if (diff !== 0) return diff;
  }

  return left.length - right.length;
}

export function createOrderKeyBetween(before: string | null, after: string | null): string {
  if (!before && !after) return "a0";

  let prefix = "";
  for (let index = 0; index < 64; index += 1) {
    const low = before ? rank(before[index], 0) : 0;
    const high = after ? rank(after[index], ALPHABET.length - 1) : ALPHABET.length - 1;
    if (high - low > 1) {
      return `${prefix}${ALPHABET[Math.floor((low + high) / 2)]}`;
    }
    prefix += ALPHABET[low];
  }
  return `${before ?? "a"}V`;
}

export function createOrderKeysBetween(before: string | null, after: string | null, count: number): string[] {
  const keys: string[] = [];
  let previous = before;

  for (let index = 0; index < count; index += 1) {
    const key = createOrderKeyBetween(previous, after);
    keys.push(key);
    previous = key;
  }

  return keys;
}

export function createSequentialOrderKey(index: number): string {
  return `m${Math.max(0, index).toString(36).padStart(8, "0")}`;
}

export function hasNonIncreasingOrderKeys<T extends { order_key: string }>(items: T[]): boolean {
  return items.some((item, index) => index > 0 && compareOrderKeys(items[index - 1].order_key, item.order_key) >= 0);
}

export function reindexOrderKeys<T extends { order_key: string }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order_key: createSequentialOrderKey(index) }));
}

export function sortByOrderKey<T extends { order_key: string; created_at?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const order = compareOrderKeys(a.order_key, b.order_key);
    if (order !== 0) return order;
    return compareOptionalString(a.created_at, b.created_at);
  });
}
