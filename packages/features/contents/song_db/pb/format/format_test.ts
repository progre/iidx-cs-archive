// 難易度名から欄の位置を引く計算(format.ts)を、原盤を読まずに確かめる。
import { assertEquals, assertThrows } from "@std/assert";
import { difficultyOf } from "./difficulties.ts";
import { PB_CHART_SLOTS, PB_DEFINITION, PB_FORMAT } from "../testing.ts";

const { chart } = PB_DEFINITION.songDbRecordLayout;
const CHARTS = chart.files.offset;
const SOUNDS = chart.sounds.offset;

Deno.test("難易度名から譜面欄の位置を引ける", () => {
  assertEquals(PB_FORMAT.chartFieldOffset("sp_hyper"), CHARTS);
  assertEquals(PB_FORMAT.chartFieldOffset("dp_hyper"), CHARTS + 4);
  assertEquals(PB_FORMAT.chartFieldOffset("sp_normal"), CHARTS + 0x10);
  assertEquals(PB_FORMAT.chartFieldOffset("dp_black"), CHARTS + 0x24);
});

// 組の並びは[0,2],[1,3],[4,6],[5,7],…(difficulties.tsのコメント通り)
Deno.test("難易度名から音の欄の位置を引ける", () => {
  assertEquals(PB_FORMAT.keysoundFieldOffset("sp_hyper") - SOUNDS, 0);
  assertEquals(PB_FORMAT.bgmFieldOffset("sp_hyper") - SOUNDS, 4);
  assertEquals(PB_FORMAT.keysoundFieldOffset("dp_hyper") - SOUNDS, 2);
  assertEquals(PB_FORMAT.keysoundFieldOffset("sp_another") - SOUNDS, 8);
  assertEquals(PB_FORMAT.keysoundFieldOffset("dp_black") - SOUNDS, 34);
});

Deno.test("レベル欄の番号はstyleとrankから一意に決まる", () => {
  assertEquals(difficultyOf("sp_normal").levelIndex, 0);
  assertEquals(difficultyOf("dp_normal").levelIndex, 5);
  const indices = new Set(
    PB_CHART_SLOTS.map((name) => difficultyOf(name).levelIndex),
  );
  assertEquals(indices.size, PB_CHART_SLOTS.length);
});

Deno.test("譜面欄の位置から難易度名を引ける", () => {
  PB_CHART_SLOTS.forEach((name) => {
    assertEquals(
      PB_FORMAT.difficultyNameOfChartField(PB_FORMAT.chartFieldOffset(name)),
      name,
    );
  });
  assertThrows(() => PB_FORMAT.difficultyNameOfChartField(CHARTS + 0x40));
});

Deno.test("曲DBへ書く範囲は、エントリを写す世代と合成する世代で違う", () => {
  assertEquals(PB_FORMAT.entryRangesOf(true), [
    [0x00, 0x64],
    [0x94, 0xc0],
    [0xc0, 0x108],
    [0x108, 0x134],
  ]);
  assertEquals(PB_FORMAT.entryRangesOf(false), [
    [0x00, 0x64],
    [0xbd, 0xbe],
    [0xc0, 0x108],
    [0x108, 0x132],
  ]);
});

Deno.test("未知の難易度名を渡すと、エラーになる", () => {
  assertThrows(() => difficultyOf("sp_extra"));
});
