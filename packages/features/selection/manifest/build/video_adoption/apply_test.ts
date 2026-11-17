// 同じ内容のムービーを、採用した1本に使わせる差し替え。
// ダミーの曲の行と、ダミーの`+0x62`で確かめる。
// 実行: deno test packages/features/selection/manifest/build/video_adoption/apply_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import { adoptedInCsa } from "./adopted.ts";
import { adoptVideos } from "./apply.ts";
import {
  fieldOf,
  songOf,
  sourcesOf,
  VIDEO_FIELD,
  videoAsset,
  videoOf,
} from "./testing.ts";

const adoption = (
  song: [string, number],
  adopt: [string, number],
  slot = 0,
  adoptSlot = 0,
) => ({
  song: { generation: song[0], songId: song[1] },
  slot,
  adopt: { generation: adopt[0], songId: adopt[1] },
  adoptSlot,
});

Deno.test("CSAに載る採用元の資産を置き、+0x62を採用元に合わせる", () => {
  const sources = sourcesOf(
    [{ generation: "red", songId: 3, asset: videoAsset(500, 480) }],
    new Map([["red/3", 0x01]]),
  );
  const { songs, adopted } = adoptVideos(
    [songOf("8th", 88, "asset")],
    [adoption(["8th", 88], ["red", 3])],
    sources,
  );
  const [song] = songs;
  const video = song.assets.find(({ kind }) => kind === "video")!;
  assertEquals(adopted, 1);
  assertEquals(song.assets[1], video);
  assertEquals(video.sourceGeneration, "red");
  assertEquals(video.sourceOffset, 500);
  assertEquals(video.references[0].fieldOffset, VIDEO_FIELD);
  assertEquals(videoOf(song.entry), { abc: 0, flags: 0x03 });
});

Deno.test("共有BGAを参照していた曲も、採用元の資産に置き換える", () => {
  const sources = sourcesOf(
    [{ generation: "red", songId: 3, asset: videoAsset(500, 240) }],
    new Map(),
  );
  const [song] = adoptVideos(
    [songOf("8th", 88, "fallback")],
    [adoption(["8th", 88], ["red", 3])],
    sources,
  ).songs;
  assertEquals(song.videoFields.length, 0);
  assertEquals(song.assets.filter(({ kind }) => kind === "video").length, 1);
});

Deno.test("PBにしか無い採用元は、資産を置かずにPBのABC indexを書く", () => {
  const sources = sourcesOf([], new Map([["pb/5", 0x83]]));
  const [song] = adoptVideos(
    [songOf("3rd", 1, "asset")],
    [adoption(["3rd", 1], ["pb", 5])],
    sources,
  ).songs;
  assertEquals(song.assets.some(({ kind }) => kind === "video"), false);
  assertEquals(videoOf(song.entry), { abc: 900, flags: 0x03 });
});

Deno.test("採用元と同じムービーの曲で引き伸ばしの印が違えば止める", () => {
  const asset = videoAsset(500, 240);
  const sources = sourcesOf(
    [
      { generation: "red", songId: 3, asset },
      { generation: "red", songId: 4, asset },
    ],
    new Map([["red/3", 0x01]]),
  );
  assertThrows(
    () =>
      adoptVideos(
        [songOf("8th", 88, "asset")],
        [adoption(["8th", 88], ["red", 3])],
        sources,
      ),
    Error,
    "引き伸ばしの印が違う",
  );
});

/** 2本目のムービーも持つ曲。2本目は、ムービーの2番目のフィールドから参照する */
function twoVideoSong() {
  const song = songOf("hs", 68, "asset");
  const second = {
    ...song.assets[1],
    references: [{ fieldOffset: SECOND_FIELD, width: "u32" as const }],
    sourceFileIndex: 3,
  };
  return { ...song, assets: [...song.assets, second] };
}

const SECOND_FIELD = VIDEO_FIELD + 4;

Deno.test("2本を持つ曲は、表の何本目だけを差し替え、印が違えば止める", () => {
  const [song] = adoptVideos(
    [twoVideoSong()],
    [adoption(["hs", 68], ["pb", 5], 1)],
    sourcesOf([], new Map()),
  ).songs;
  const videos = song.assets.filter(({ kind }) => kind === "video");
  assertEquals(videos.map((video) => video.sourceFileIndex), [2]);
  assertEquals(fieldOf(song.entry, SECOND_FIELD), 900);
  assertThrows(
    () =>
      adoptVideos(
        [twoVideoSong()],
        [adoption(["hs", 68], ["pb", 5], 1)],
        sourcesOf([], new Map([["pb/5", 0x02]])),
      ),
    Error,
    "ムービーの印が違う",
  );
});

Deno.test("ムービーが1本の曲は、slotが1の行でも1本目のフィールドと+0x62を差し替える", () => {
  const [song] = adoptVideos(
    [songOf("3rd", 2, "asset")],
    [adoption(["3rd", 2], ["pb", 5], 1)],
    sourcesOf([], new Map([["pb/5", 0x01]])),
  ).songs;
  assertEquals(videoOf(song.entry), { abc: 900, flags: 0x01 });
});

Deno.test("表に無い曲はそのまま返す", () => {
  const song = songOf("8th", 88, "asset");
  const { songs, adopted } = adoptVideos(
    [song],
    [],
    sourcesOf([], new Map()),
  );
  assertEquals(adopted, 0);
  assertEquals(songs[0], song);
});

Deno.test("差し替える前の自分のムービーを、補正前の値に残す", () => {
  const sources = sourcesOf(
    [{ generation: "red", songId: 3, asset: videoAsset(500, 240) }],
    new Map(),
  );
  const [song] = adoptVideos(
    [songOf("8th", 88, "asset")],
    [adoption(["8th", 88], ["red", 3])],
    sources,
  ).songs;
  assertEquals(song.uncorrected?.videos, [
    { sourceFileIndex: 2, sourceGeneration: "8th" },
  ]);
});

Deno.test("採用元のムービーが2本あれば、adopt_slot の番号の1本を使う", () => {
  const sources = sourcesOf(
    [{ generation: "red", songId: 3, asset: videoAsset(500, 240) }],
    new Map(),
  );
  const [row] = sources.songs;
  const twoVideos = {
    ...sources,
    songs: [{
      ...row,
      sourceAssets: [videoAsset(500, 240), videoAsset(700, 240)],
    }],
  };
  const adopted = adoptedInCsa(twoVideos, { generation: "red", songId: 3 }, 1);
  assertEquals("asset" in adopted ? adopted.asset.sourceOffset : null, 700);
});
