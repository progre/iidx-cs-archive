// 表の1行をmanifestの1曲にする判断と、ムービーの判定。
// 実行: deno test packages/features/selection/manifest/song/body_test.ts

import { assetSource, isOriginalVideoPlayable } from "./video.ts";
import { assertEquals, assertThrows } from "@std/assert";
import type { ManifestSongDraft, SongmapSong, SourceAsset } from "@csa/core";
import {
  adoptedVideosOf,
  copiedAssets,
  requirePlayable,
  synthesizedAssets,
} from "./body.ts";

/** 本物と同じく、小さいバッファー(240)に収まらなければ大きいバッファーが要る */
const videosOf = (row: ManifestSongDraft) =>
  adoptedVideosOf(row, ({ height, width }) => width > 240 || height > 240);

const fits = ({ width, height }: { width: number; height: number }) =>
  width <= 480 && height <= 480;

const asset = (rest: Partial<SourceAsset> = {}): SourceAsset => ({
  fields: ["sp_hyper"],
  kind: "chart",
  path: "copy",
  sourceArchive: "A.DAT",
  sourceFileIndex: 1,
  sourceOffset: 10,
  sourceSize: 20,
  ...rest,
});

const row = (assets: SourceAsset[]): ManifestSongDraft => ({
  canonicalKey: "song",
  sourceAssets: assets,
  sourceGeneration: "9th",
  sourceSongIndex: 7,
  title: "song",
});

const video = (width: number, rest: Partial<SourceAsset> = {}) =>
  asset({
    kind: "video",
    resolution: { height: width, width },
    sourceFileIndex: 2,
    ...rest,
  });

Deno.test("バッファに収まる解像度か、再符号化済みのムービーは置ける", () => {
  assertEquals(isOriginalVideoPlayable(row([video(480)]), fits), true);
  assertEquals(isOriginalVideoPlayable(row([video(720)]), fits), false);
  assertEquals(
    isOriginalVideoPlayable(
      row([video(720, { path: "reencode", output: "o.pss" })]),
      fits,
    ),
    true,
  );
  assertEquals(isOriginalVideoPlayable(row([asset()]), fits), true);
});

Deno.test("再符号化済みのムービーは変換後の単体ファイルとして置く", () => {
  const converted = video(240, { path: "reencode", output: "o.pss" });
  assertEquals(
    assetSource(
      converted,
      (output) => ({ archive: "file:" + output, size: 99 }),
    ),
    {
      sourceArchive: "file:o.pss",
      sourceFileIndex: 2,
      sourceOffset: 0,
      sourceSize: 99,
    },
  );
  assertEquals(
    assetSource(asset(), () => {
      throw new Error("使ってはならない");
    }).sourceOffset,
    10,
  );
});

Deno.test("再生できないムービーの曲は止まる", () => {
  requirePlayable(row([]), true);
  assertThrows(() => requirePlayable(row([]), false), Error, "再生できない");
});

Deno.test("採用するムービーは何本目かの順に並べ、3本以上か、バッファーの判定が食い違えば止まる", () => {
  const slot = (n: number, width = 240) =>
    video(width, { fields: [String(n)], sourceFileIndex: 10 - n });
  assertEquals(videosOf(row([asset()])), []);
  assertEquals(
    videosOf(row([slot(1), slot(0)])).map((v) => v.sourceFileIndex),
    [10, 9],
  );
  assertThrows(
    () => videosOf(row([slot(0), slot(1), slot(2)])),
    Error,
    "3本",
  );
  assertThrows(
    () => videosOf(row([slot(0), slot(1, 720)])),
    Error,
    "大きいバッファー",
  );
});

Deno.test("合成する曲の資産は、種別の順に並び、参照するフィールドを付ける", () => {
  const assets = synthesizedAssets(
    row([video(240, { sourceFileIndex: 2 }), asset({ sourceFileIndex: 1 })]),
    new Map([
      [1, [{ fieldOffset: 0xc0, width: "u32" }]],
      [2, [{ fieldOffset: 0x58, width: "u32" }]],
    ]),
    () => ({ archive: "", size: 0 }),
  );
  assertEquals(assets.map((each) => each.kind), ["chart", "video"]);
  assertThrows(
    () =>
      synthesizedAssets(
        row([asset()]),
        new Map(),
        () => ({ archive: "", size: 0 }),
      ),
    Error,
    "参照するフィールドが無い",
  );
});

Deno.test("写す曲の資産の件数が表と違えば止まる", () => {
  const songmap = {
    files: [0, 1].map((index) => ({
      archive: "A.DAT",
      index,
      offset: 0,
      size: 1,
    })),
    songs: [{
      song_id: 7,
      charts: { sp_hyper: { chart: 1, level: 1 } },
      sounds: [],
      videos: [],
    } as unknown as SongmapSong],
  };
  const references = {
    chart: [{ fieldOffset: 0xc0, fileIndex: 1, width: "u32" as const }],
    sound: [],
    video: [],
  };
  assertEquals(
    copiedAssets(row([asset()]), songmap, references, false).assets.length,
    1,
  );
  assertThrows(
    () =>
      copiedAssets(
        row([asset(), asset({ sourceFileIndex: 5 })]),
        songmap,
        references,
        false,
      ),
    Error,
    "ABC件数",
  );
});
