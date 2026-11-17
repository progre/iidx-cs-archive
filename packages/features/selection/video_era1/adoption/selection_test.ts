import { assertEquals, assertThrows } from "@std/assert";
import {
  formatKeyOf,
  formatOf,
  selectEra1JobsOf,
  squareCrop,
  standardBand,
} from "./selection.ts";
import type { Era1Source, Era1Video } from "../types.ts";

const video = (generation: string, key: string): Era1Video => ({
  archive: "A.BIN",
  generation,
  index: 1,
  key,
  offset: 0,
  partner: null,
  size: 1,
  slot: 0,
  songCount: 1,
  title: key,
});

function sourcesOf(songs: Era1Source["songs"], keys: string[]): Era1Source {
  return { songs, videos: keys.map((key) => video("3rd", key)) };
}

Deno.test("standardBand: 対応表に無い形式はundefinedを返す", () => {
  assertEquals(standardBand("6th", "640x240 6912"), undefined);
  assertEquals(standardBand("3rd", "192x256 6912"), {
    h: 236,
    w: 176,
    x: 8,
    y: 0,
  });
});

Deno.test("squareCrop: 横長だけ中央の正方形にする", () => {
  assertEquals(squareCrop({ h: 218, w: 320, x: 0, y: 2 }), {
    h: 218,
    w: 218,
    x: 51,
    y: 2,
  });
  const tall = { h: 236, w: 176, x: 8, y: 0 };
  assertEquals(squareCrop(tall), tall);
});

Deno.test("formatOf: 解像度と多重化レートを表のキーの書式にする", () => {
  assertEquals(
    formatOf({ height: 256, muxRateKbps: 6912, width: 192 }),
    "192x256 6912",
  );
});

Deno.test("selectEra1JobsOf: 3rdは2本目を採り、同じ本を指す曲をまとめる", () => {
  const sources = sourcesOf(
    [
      { id: 0, videos: ["A", "B"] },
      { id: 1, videos: ["C", "B"] },
      { id: 2, videos: [] },
    ],
    ["A", "B", "C"],
  );
  const formats = new Map([[formatKeyOf("3rd", "B"), "192x256 6912"]]);
  const jobs = selectEra1JobsOf("3rd", sources, formats);
  assertEquals(jobs.length, 1);
  assertEquals(jobs[0].video.key, "B");
  assertEquals(jobs[0].songIds, [0, 1]);
});

Deno.test("selectEra1JobsOf: 標準帯の無い形式は除く", () => {
  const sources = sourcesOf([{ id: 0, videos: ["A"] }], ["A"]);
  const formats = new Map([[formatKeyOf("3rd", "A"), "640x240 6912"]]);
  assertEquals(selectEra1JobsOf("3rd", sources, formats), []);
});

Deno.test("selectEra1JobsOf: 形式が無ければ失敗する", () => {
  const sources = sourcesOf([{ id: 0, videos: ["A"] }], ["A"]);
  assertThrows(() => selectEra1JobsOf("3rd", sources, new Map()));
});
