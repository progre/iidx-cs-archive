// reference.tsの検査。曲DBエントリーのバイト列fixtureだけで見る。原盤もELFも読まない。

import type { ArtworkLayout } from "@csa/core";
import type { DisplayLayout } from "./layouts.ts";
import {
  readSourceTitleRefs,
  readTitleCardPairs,
  readTitleCardTocIndex,
} from "./reference.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const TITLE_CARD_OFFSET = 0x10;
const PAIRS_OFFSET = 0x20;
const PAIR_COUNT = 3;

const LAYOUT: DisplayLayout = {
  imageSet: { artist: 0, big: 0, genre: 0, small: 0 },
  imageSetSlots: [0, 1, 2, 3],
  data1TocCount: 5,
  data1TocFileOffset: 0,
  descriptorStart: 8,
};

const ARTWORK: Pick<
  ArtworkLayout,
  "imageSet" | "titleCard" | "titleCardPairs"
> = {
  imageSet: { count: 5, offset: 4 },
  titleCard: { bytes: 4, offset: TITLE_CARD_OFFSET },
  titleCardPairs: { count: PAIR_COUNT, offset: PAIRS_OFFSET },
};

function fakeEntry(): Uint8Array {
  return new Uint8Array(PAIRS_OFFSET + PAIR_COUNT * 4);
}

Deno.test("titleCardOffsetの位置のu32が曲名カードの番号になる", () => {
  const entry = fakeEntry();
  new DataView(entry.buffer).setUint32(TITLE_CARD_OFFSET, 3, true);
  assertEquals(
    readTitleCardTocIndex(entry, 0, LAYOUT, ARTWORK),
    3,
    "曲名カード番号",
  );
});

Deno.test("曲名カードの番号が0かdata1TocCount以上なら例外になる", () => {
  const zero = fakeEntry();
  let threw = false;
  try {
    readTitleCardTocIndex(zero, 0, LAYOUT, ARTWORK);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "0は例外");

  const tooLarge = fakeEntry();
  new DataView(tooLarge.buffer).setUint32(TITLE_CARD_OFFSET, 5, true);
  threw = false;
  try {
    readTitleCardTocIndex(tooLarge, 0, LAYOUT, ARTWORK);
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "data1TocCount以上は例外");
});

Deno.test("entryOffsetを足した位置から読む", () => {
  const entry = new Uint8Array(0x40 + PAIRS_OFFSET + PAIR_COUNT * 4);
  new DataView(entry.buffer).setUint32(0x40 + TITLE_CARD_OFFSET, 4, true);
  assertEquals(
    readTitleCardTocIndex(entry, 0x40, LAYOUT, ARTWORK),
    4,
    "曲名カード番号",
  );
});

const REFS_LAYOUT = {
  imageSet: { artist: 12, big: 11, genre: 10, small: 13 },
  imageSetSlots: [0, 1, 2, 4] as DisplayLayout["imageSetSlots"],
};

/** 5枠のうち、読まない4枠目(添字3)には、どの画像セットも指さない値を入れて使う */
function entryWithRefs(offset: number, files: number[]): Uint8Array {
  const entry = new Uint8Array(offset + 4 + 5 * 4);
  const view = new DataView(entry.buffer);
  files.forEach((file, slot) => {
    view.setUint16(offset + 4 + slot * 4, 100 + slot, true);
    view.setUint16(offset + 4 + slot * 4 + 2, file, true);
  });
  return entry;
}

Deno.test("画像セット欄は、枠の番号の位置からsprite番号と画像セットの番号を読む", () => {
  const refs = readSourceTitleRefs(
    entryWithRefs(8, [10, 11, 12, 99, 13]),
    8,
    REFS_LAYOUT,
    ARTWORK,
  );
  assertEquals(
    JSON.stringify(refs),
    JSON.stringify([
      { fileIndex: 10, sprite: 100 },
      { fileIndex: 11, sprite: 101 },
      { fileIndex: 12, sprite: 102 },
      { fileIndex: 13, sprite: 104 },
    ]),
    "sprite参照",
  );
});

Deno.test("素材の画像セットを指さない欄があれば例外になる", () => {
  let threw = false;
  try {
    readSourceTitleRefs(
      entryWithRefs(0, [10, 11, 12, 99, 99]),
      0,
      REFS_LAYOUT,
      ARTWORK,
    );
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "13を指す欄が無い");
});

Deno.test("曲名カードの組を、組の数だけ読む", () => {
  const entry = fakeEntry();
  const view = new DataView(entry.buffer);
  view.setUint16(PAIRS_OFFSET, 1, true);
  view.setUint16(PAIRS_OFFSET + 2, 12, true);
  view.setUint16(PAIRS_OFFSET + 8, 3, true);
  view.setUint16(PAIRS_OFFSET + 10, 13, true);
  const pairs = readTitleCardPairs(entry, 0, ARTWORK);
  assertEquals(pairs.length, PAIR_COUNT, "組の数");
  assertEquals(
    JSON.stringify(pairs[0]),
    JSON.stringify({ animation: 1, file: 12 }),
    "先頭の組",
  );
  assertEquals(
    JSON.stringify(pairs[2]),
    JSON.stringify({ animation: 3, file: 13 }),
    "3組目",
  );
});
