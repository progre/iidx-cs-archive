// 採用しない版を使うPBの曲の書き換えと、空くPBのファイル。
// 実行: deno test packages/features/selection/manifest/build/video_adoption/pb_test.ts

import { assertEquals } from "@std/assert";
import { redirectPbVideos } from "./pb.ts";
import { sourcesOf, videoAsset } from "./testing.ts";

const pb = (songId: number) => ({ generation: "pb", songId });

/** 曲0がABC 10、曲1と曲2がABC 20を使う。曲0の`+0x62`は0x83 */
const sourcesWith = (videos: Record<number, number[]>) =>
  sourcesOf(
    [],
    new Map([["pb/0", 0x83]]),
    Object.entries(videos).map(([songId, list]) => ({
      song_id: Number(songId),
      videos: list,
    })),
    [
      { archive: "A.DAT", index: 10, offset: 0, size: 4096 },
      { archive: "A.DAT", index: 20, offset: 4096, size: 6000 },
    ],
  );

Deno.test("書き換えたPBの曲だけが使っていたファイルは空く", () => {
  const result = redirectPbVideos(
    [
      { adopt: pb(0), slot: 0, adoptSlot: 0, song: pb(1) },
      { adopt: pb(0), slot: 0, adoptSlot: 0, song: pb(2) },
    ],
    sourcesWith({ 0: [10], 1: [20], 2: [20] }),
  );
  assertEquals(result.redirects, [
    { abcIndex: 10, flags: 0x03, songIndex: 1 },
    { abcIndex: 10, flags: 0x03, songIndex: 2 },
  ]);
  assertEquals(result.freed, [
    { abcIndex: 20, archive: "A.DAT", offset: 4096, size: 6000 },
  ]);
});

Deno.test("書き換えない曲がまだ使うファイルは空かない", () => {
  const result = redirectPbVideos(
    [{ adopt: pb(0), slot: 0, adoptSlot: 0, song: pb(1) }],
    sourcesWith({ 0: [10], 1: [20], 2: [20] }),
  );
  assertEquals(result.freed, []);
});

Deno.test("PBでない曲の行は書き換えない", () => {
  const result = redirectPbVideos(
    [{
      adopt: pb(0),
      slot: 0,
      adoptSlot: 0,
      song: { generation: "dd", songId: 1 },
    }],
    sourcesWith({ 0: [10] }),
  );
  assertEquals(result, { freed: [], redirects: [] });
});

Deno.test("PBの曲の採用元がPBの曲でなければ、CSAが置くその曲の資産を指す", () => {
  const sources = sourcesOf(
    [{ generation: "dd", songId: 3, asset: videoAsset(500, 240) }],
    new Map(),
    [{ song_id: 0, videos: [10] }, { song_id: 1, videos: [20] }],
    [{ archive: "A.DAT", index: 20, offset: 4096, size: 6000 }],
  );
  const result = redirectPbVideos(
    [{
      adopt: { generation: "dd", songId: 3 },
      slot: 0,
      adoptSlot: 0,
      song: pb(1),
    }],
    sources,
  );
  const [redirect] = result.redirects;
  assertEquals("asset" in redirect ? redirect.asset.sourceOffset : null, 500);
  assertEquals(result.freed.map(({ abcIndex }) => abcIndex), [20]);
});
