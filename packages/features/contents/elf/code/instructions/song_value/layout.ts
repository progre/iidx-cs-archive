/**
 * 項目配列群(scene、owner、list context、state)の移設配置。
 *
 * 原盤は項目配列497バイト、直後にmode配列497バイト(list contextはさらにflags配列)を
 * 持つ。容量を曲数に追従させるため、4本とも構造体末尾の新領域へ移し、元の位置は捨てる。
 * 配列の先頭を指すpointerは元の位置のまま渡され、触る側(byte access、memcpy、memset)が
 * 一律の距離を足す。項目配列の下位・上位、mode、flagsの順に容量`C`ずつ並べる。
 * list contextは位置で引く行オフセット配列`int[497]`も持つので、flagsの後ろへ`int[C]`で移す。
 */

/** 元の項目配列から移設先(下位配列)までの距離。list contextの既存member長。 */
export const ITEM_LOW_DELTA = 0x1650;
export const PB_ITEM_CAPACITY = 0x1f1;
/** list contextの行オフセット配列`int[497]`の元の位置と長さ。 */
export const ROW_OFFSETS_OFFSET = 0x634;
export const ROW_OFFSETS_LENGTH = 0x7c4;
/** stateは項目配列を`+0x814`と`+0x878`に2本持つ。2本目は1本目の4本の後ろへ置く。 */
const STATE_SECOND_OFFSET = 0x64;

export type ItemLayout = Readonly<{ capacity: number; entries: number }>;

/**
 * mode配列を埋めるループは8バイトずつ書いて最後に1バイト足すので、容量は`8k+1`にする。
 * 原盤の497も`8*62+1`である。項目配列は1styleの全譜面(最大`E`件)を複写されるので、
 * 容量は特殊項目2つを足した`E+2`以上も要る(原盤は`495+2`)。
 */
export function makeItemLayout(entries: number, capacity: number): ItemLayout {
  if (
    !Number.isInteger(capacity) || capacity < PB_ITEM_CAPACITY ||
    capacity % 8 !== 1
  ) {
    throw new Error("項目容量は497以上で8で割って1余る整数を指定する");
  }
  if (capacity < entries + 2) {
    throw new Error("項目容量はrecord容量E+2以上を指定する");
  }
  return { capacity, entries };
}

/** stubへ渡す距離の名前。`entries`はrecord内の曲index上位配列までの距離。 */
export type DeltaKind =
  | "entries"
  | "flags"
  | "high"
  | "high2"
  | "low"
  | "low2"
  | "modes"
  | "none"
  | "rows";

export function resolveDelta(layout: ItemLayout, kind: DeltaKind): number {
  const { capacity, entries } = layout;
  const low = ITEM_LOW_DELTA;
  switch (kind) {
    case "none":
      return 0;
    case "entries":
      return entries;
    case "low":
      return low;
    case "high":
      return low + capacity;
    case "low2":
      return low + capacity * 2 - STATE_SECOND_OFFSET;
    case "high2":
      return low + capacity * 3 - STATE_SECOND_OFFSET;
    case "modes":
      return low + capacity * 2 - PB_ITEM_CAPACITY;
    case "flags":
      return low + capacity * 3 - PB_ITEM_CAPACITY * 2;
    case "rows":
      return low + capacity * 4 - ROW_OFFSETS_OFFSET;
  }
}

export type SiteKind = "flags" | "items" | "modes" | "song";

/** 曲値を触る1命令。`second`はstateが持つ2本目の項目配列を指すことを表す。 */
export type SongValueSite = Readonly<{
  address: number;
  kind: SiteKind;
  second: boolean;
}>;

/** byte access 1件の下位・上位の距離。上位を持たない配列は`high`を返さない。 */
export function siteDeltas(
  layout: ItemLayout,
  site: SongValueSite,
): Readonly<{ high?: number; low: number }> {
  if (site.kind === "song") return { high: layout.entries, low: 0 };
  if (site.kind === "modes") return { low: resolveDelta(layout, "modes") };
  if (site.kind === "flags") return { low: resolveDelta(layout, "flags") };
  return site.second
    ? {
      high: resolveDelta(layout, "high2"),
      low: resolveDelta(layout, "low2"),
    }
    : { high: resolveDelta(layout, "high"), low: resolveDelta(layout, "low") };
}
