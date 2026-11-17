import { assertEquals } from "@std/assert";
import { difficultyOf } from "./difficulties.ts";
import { PB_CHART_SLOTS, PB_FORMAT } from "../testing.ts";

Deno.test("levelsOfは全難易度のレベル欄を、譜面の並びの順に難易度名で返す", () => {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  const levels = record.selection.levels;
  levels[difficultyOf("sp_another").levelIndex] = 9;
  levels[difficultyOf("dp_black").levelIndex] = 12;
  record.selection.levels = levels;
  const read = PB_FORMAT.levelsOf(record);
  assertEquals(Object.keys(read), PB_CHART_SLOTS);
  assertEquals(read["sp_another"], 9);
  assertEquals(read["dp_black"], 12);
  assertEquals(read["sp_normal"], 0);
});

Deno.test("noteCountsOfはDPの1Pと2Pを足す", () => {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  const notes = record.chart.notes ?? [];
  const [p1, p2] = difficultyOf("dp_hyper").notesIndices;
  notes[p1] = 300;
  notes[p2] = 301;
  notes[difficultyOf("sp_hyper").notesIndices[0]] = 500;
  record.chart.notes = notes;
  const counts = PB_FORMAT.noteCountsOf(record);
  assertEquals(counts["dp_hyper"], 601);
  assertEquals(counts["sp_hyper"], 500);
});
