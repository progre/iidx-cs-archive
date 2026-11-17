import { assertThrows } from "@std/assert";
import { metaTextOf } from "./conversion.ts";
import { checkConvertedReport } from "./conversion.ts";
import type { Era1Job } from "./types.ts";

const job: Era1Job = {
  band: { h: 218, w: 320, x: 0, y: 2 },
  crop: { h: 218, w: 218, x: 51, y: 2 },
  songIds: [3],
  video: {
    archive: "A.BIN",
    generation: "6th",
    index: 5,
    key: "A_0005",
    offset: 100,
    partner: null,
    size: 1000,
    slot: 1,
    songCount: 1,
    title: "曲",
  },
};

const textOf = (problems: string[], target: Era1Job = job) =>
  metaTextOf(target, { pictures: 10, problems, size: 16384 });

Deno.test("問題が無く、元のファイルが同じなら通る", () => {
  checkConvertedReport(job, textOf([]));
});

Deno.test("元のアーカイブ名は、大文字と小文字を区別しない", () => {
  const lower = { ...job, video: { ...job.video, archive: "a.bin" } };
  checkConvertedReport(job, textOf([], lower));
});

Deno.test("問題が記録されていれば例外にする", () => {
  assertThrows(
    () => checkConvertedReport(job, textOf(["解像度 320x240"])),
    Error,
    "変換済みムービーに問題: 解像度 320x240",
  );
});

Deno.test("元のファイルの位置が違えば例外にする", () => {
  const other = { ...job, video: { ...job.video, offset: 200 } };
  assertThrows(
    () => checkConvertedReport(job, textOf([], other)),
    Error,
    "元ファイルが違う",
  );
});
