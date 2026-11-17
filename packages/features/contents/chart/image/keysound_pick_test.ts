// 素材世代のローダーと同じ引き方でキー音バンクを決められるかを、組み立てたエントリで見る。原盤は読まない。
import { assertEquals as assertDeep } from "@std/assert";
import type { ChartLayout } from "@csa/core";
import { keysoundLayoutOf, pickKeysound } from "./keysound_pick.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

/** `offset → s16`を書いたエントリ。書かない位置は-1(無し)で埋める */
function entry(values: Record<number, number>, size = 0xa4): Uint8Array {
  const bytes = new Uint8Array(size).fill(0xff);
  const view = new DataView(bytes.buffer);
  for (const [offset, value] of Object.entries(values)) {
    view.setInt16(Number(offset), value, true);
  }
  return bytes;
}

/** 3rd〜8thの譜面の並び */
const SLOTS = [
  "sp_hyper",
  "dp_hyper",
  "sp_another",
  "dp_another",
  "sp_normal",
  "dp_normal",
  "sp_beginner",
  "dp_beginner",
];

const layoutOf = (
  offset: number,
  count: number,
  archive: number | null = null,
) =>
  keysoundLayoutOf(
    {
      files: { count: SLOTS.length, offset: 0 },
      keysoundArchiveOffset: archive,
      sounds: { count, offset },
    } as ChartLayout,
    SLOTS,
  );

const THIRD = layoutOf(0x6c, 4);
const FIFTH = layoutOf(0x7c, 16);
const SEVENTH = layoutOf(0x78, 16, 0x40);

Deno.test("キー音のオフセットは、音の並びに収まる難易度だけを持つ", () => {
  assertDeep(layoutOf(0x70, 12), { another: 0x78, hyper: 0x70, normal: 0x80 });
  assertDeep(SEVENTH, {
    another: 0x80,
    archiveOffset: 0x40,
    beginner: 0x90,
    hyper: 0x78,
    normal: 0x88,
  });
});

const noArchive = () => {
  throw new Error("archiveを持たない世代で呼ばれた");
};

Deno.test("SPは既定のフィールドの1つ目、DPは2つ目を鳴らす", () => {
  const bytes = entry({ 0x6c: 105, 0x6e: 104 });
  assertEquals(pickKeysound(bytes, THIRD, "sp_hyper", noArchive), 105, "SP");
  assertEquals(pickKeysound(bytes, THIRD, "dp_another", noArchive), 104, "DP");
});

Deno.test("自側の値が負なら他側を鳴らし、両側とも負なら決まらない", () => {
  const oneSide = entry({ 0x6c: 105 });
  assertEquals(
    pickKeysound(oneSide, THIRD, "dp_hyper", noArchive),
    105,
    "他側",
  );
  const none = entry({});
  assertEquals(
    pickKeysound(none, THIRD, "sp_hyper", noArchive),
    undefined,
    "無し",
  );
});

Deno.test("難易度のフィールドは正の値だけが既定の値を上書きする", () => {
  const bytes = entry({ 0x7c: 10, 0x7e: 11, 0x84: 20, 0x8c: 0 });
  assertEquals(pickKeysound(bytes, FIFTH, "sp_another", noArchive), 20, "正");
  assertEquals(pickKeysound(bytes, FIFTH, "sp_normal", noArchive), 10, "0");
  assertEquals(pickKeysound(bytes, FIFTH, "dp_another", noArchive), 11, "負");
});

Deno.test("自側が無いとき、他側も難易度のフィールドで上書きしてから借りる", () => {
  const bytes = entry({ 0x7c: 10, 0x94: 30 });
  assertEquals(
    pickKeysound(bytes, FIFTH, "dp_beginner", noArchive),
    30,
    "他側",
  );
});

Deno.test("archiveを持つ世代は、その先頭のfile indexを足す", () => {
  const bytes = entry({ 0x78: 5 }, 0xa0);
  bytes[0x40] = 2;
  const base = (archive: number) => archive === 2 ? 138 : -1;
  assertEquals(pickKeysound(bytes, SEVENTH, "sp_hyper", base), 143, "7th");
});
