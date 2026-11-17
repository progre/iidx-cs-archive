import { assertEquals, assertRejects } from "@std/assert";
import {
  asset,
  contextOf,
  listing,
  songDraft,
  songmapSong,
  sourceFile,
} from "../testing.ts";
import { buildableSongs } from "./assemble.ts";
import { buildGenerationRows } from "./generation_rows.ts";
import { summarize } from "./assemble.ts";

Deno.test("全曲リストに2行書いた曲は、行ごとに1行にする", async () => {
  const back = listing({
    variant: { generation: "dd", rule: "custom", songId: 74 },
  });
  const rows = await buildGenerationRows(
    contextOf("10th", [sourceFile(1)]),
    [songmapSong(1)],
    () => "ONE",
    () => [listing(), back],
  );
  assertEquals(rows.map((row) => row.variantOf?.songId), [undefined, 74]);
});

const twoDifficulties = songmapSong(1, {
  charts: {
    sp_another: { chart: 1, level: 10 },
    sp_normal: { chart: 3, level: 5 },
  },
  videos: [2],
});
const another = {
  overlayOnlyAnother: true,
  titleCardSprite: 1,
  video: 4,
};
const filesOfTwo = [1, 2, 3, 4].map((index) => sourceFile(index));

Deno.test("ANOTHERで素材を使い分ける曲は、行に残る譜面の難易度で素材を決める", async () => {
  const rows = await buildGenerationRows(
    contextOf("red", filesOfTwo),
    [twoDifficulties],
    () => "ONE",
    () => [
      listing({ another, excludedCharts: ["sp_another"] }),
      listing({ another, excludedCharts: ["sp_normal"] }),
    ],
  );
  const videos = rows.map((row) =>
    row.sourceAssets.filter((asset) => asset.kind === "video")
      .map((asset) => asset.sourceFileIndex)
  );
  assertEquals(videos, [[2], [4]]);
  assertEquals(rows.map((row) => row.overlayOnlyAnother), [true, true]);
  assertEquals(rows.map((row) => row.anotherTitleCardSprite), [1, 1]);
});

Deno.test("ANOTHERで素材を使い分ける曲で、ANOTHERとほかの難易度を1行に含むと止まる", async () => {
  await assertRejects(
    () =>
      buildGenerationRows(
        contextOf("red", filesOfTwo),
        [twoDifficulties],
        () => "ONE",
        () => [listing({ another })],
      ),
    Error,
    "1行にある",
  );
});

Deno.test("譜面の無い終端スロットは飛ばし、keyが無い曲は世代と番号で名付ける", async () => {
  const files = [sourceFile(1)];
  const rows = await buildGenerationRows(
    contextOf("10th", files),
    [songmapSong(1), songmapSong(2, { charts: {} }), songmapSong(3)],
    (song) => song.song_id === 1 ? "ONE" : "",
    () => [listing()],
  );
  assertEquals(rows.map((row) => [row.sourceSongIndex, row.canonicalKey]), [
    [1, "ONE"],
    [3, "10th:3"],
  ]);
});

Deno.test("載せる行は除外の印が無い行だけである", () => {
  const chart = [asset("chart", "source")];
  const songs = [
    songDraft("10th", 1, chart),
    songDraft("10th", 2, chart, { excluded: true }),
  ];
  assertEquals(buildableSongs(songs).map((song) => song.sourceSongIndex), [1]);
});

Deno.test("1世代の内訳を1行にまとめる", () => {
  const rows = [
    songDraft("10th", 1, [asset("chart", "source"), asset("video", "copy")]),
    songDraft("10th", 2, [asset("bgm", "source")], {
      excluded: true,
    }),
  ];
  assertEquals(
    summarize("10th", rows),
    "10th: 2 rows (5-key 0, excluded 1, no video 1) " +
      "videos reencode 0 / copy 1 / excluded 0",
  );
});
