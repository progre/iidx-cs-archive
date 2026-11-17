// 全曲リストの難易度の書き込み。実データを使わず、組み立てたエントリで確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { SongDbRecord } from "../record/mod.ts";
import { difficultyOf } from "./format/mod.ts";
import { PB_FORMAT } from "./testing.ts";
import { limitBeginnerLevel, writeDifficultyLevels } from "./catalog_levels.ts";

function setLevel(record: SongDbRecord, name: string, level: number): void {
  const levels = record.selection.levels;
  levels[difficultyOf(name).levelIndex] = level;
  record.selection.levels = levels;
}

function setNotes(record: SongDbRecord, index: number, count: number): void {
  const notes = record.chart.notes ?? [];
  notes[index] = count;
  record.chart.notes = notes;
}

/** 指定した譜面にノーツ数を入れ、レベル欄は原作の値(1)で埋めたエントリ */
function recordWith(...names: string[]): SongDbRecord {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  for (const name of names) {
    setNotes(record, difficultyOf(name).notesIndices[0], 100);
    setLevel(record, name, 1);
  }
  return record;
}

const levelOf = (record: SongDbRecord, name: string) =>
  record.selection.levels[difficultyOf(name).levelIndex];

Deno.test("書いた譜面のレベル欄だけを書き換え、書いていない譜面は原作のままにする", () => {
  const record = recordWith("sp_normal", "sp_hyper", "dp_hyper");
  writeDifficultyLevels(record, [["sp_normal", 5], ["dp_hyper", 9]]);
  assertEquals(levelOf(record, "sp_normal"), 5);
  assertEquals(levelOf(record, "dp_hyper"), 9);
  assertEquals(levelOf(record, "sp_hyper"), 1);
});

Deno.test("DPの譜面は、1Pと2Pのどちらかにノーツがあれば譜面がある", () => {
  const record = recordWith();
  setNotes(record, difficultyOf("dp_another").notesIndices[1], 50);
  writeDifficultyLevels(record, [["dp_another", 11]]);
  assertEquals(levelOf(record, "dp_another"), 11);
});

Deno.test("曲に無い譜面へ値を書くと、止まる", () => {
  const record = recordWith("sp_normal");
  assertThrows(
    () => writeDifficultyLevels(record, [["sp_another", 10]]),
    Error,
    "sp_another=10",
  );
});

Deno.test("skipMissingなら、曲に無い譜面を飛ばして書く", () => {
  const record = recordWith("sp_normal");
  writeDifficultyLevels(record, [["sp_normal", 4], ["sp_another", 10]], true);
  assertEquals(levelOf(record, "sp_normal"), 4);
  assertEquals(levelOf(record, "sp_another"), 0);
});

Deno.test("SP BEGINNER のレベルは3を超えれば3にし、3以下ならそのままにする", () => {
  const levels = [2, 3, 6].map((level) => {
    const record = recordWith("sp_beginner", "sp_hyper");
    setLevel(record, "sp_beginner", level);
    setLevel(record, "sp_hyper", 9);
    limitBeginnerLevel(record);
    return [levelOf(record, "sp_beginner"), levelOf(record, "sp_hyper")];
  });
  assertEquals(levels, [[2, 9], [3, 9], [3, 9]]);
});
