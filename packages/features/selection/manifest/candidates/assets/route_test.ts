import { assertEquals, assertRejects } from "@std/assert";
import { contextOf, songmapSong, sourceFile } from "../testing.ts";
import { collectFields } from "./fields.ts";
import { buildSongAssets } from "../rows/mod.ts";
import { sourceKeyOf } from "./video.ts";
import { groupEra1Jobs } from "./video.ts";
import type { Era1VideoJob } from "./types.ts";

const files = [1, 2, 3, 4, 5].map((index) => sourceFile(index));

Deno.test("欄は同じファイルを指す名前を並べ、資産は種別と番号の順に並ぶ", () => {
  const song = songmapSong(1, {
    charts: {
      sp_hyper: { chart: 1, level: 7 },
      dp_hyper: { chart: 1, level: 8 },
    },
    sounds: [
      { bgm: 3, keysound: 4, pair: "b" },
      { bgm: 3, keysound: 5, pair: "a" },
    ],
    videos: [2],
  });
  assertEquals(collectFields(song, "bgm").get(3), ["a", "b"]);
  return buildSongAssets(contextOf("10th", files), song).then((assets) => {
    assertEquals(
      assets.map((asset) => `${asset.kind}:${asset.sourceFileIndex}`),
      ["chart:1", "video:2", "bgm:3", "keysound:4", "keysound:5"],
    );
    assertEquals(assets[0].fields, ["dp_hyper", "sp_hyper"]);
    assertEquals(assets[0].path, "source");
    assertEquals(assets[1].path, "copy");
    assertEquals(assets[1].resolution, { height: 240, width: 320 });
    assertEquals(assets[2].path, "source");
  });
});

Deno.test("2本目のムービーは、中身が1本目と違うときだけ素材にする", async () => {
  const videosOf = async (same: boolean) =>
    (await buildSongAssets(
      contextOf("10th", files, { sameBytes: () => Promise.resolve(same) }),
      songmapSong(1, { videos: [2, 3] }),
    )).filter((asset) => asset.kind === "video")
      .map((asset) => asset.sourceFileIndex);
  assertEquals(await videosOf(true), [2]);
  assertEquals(await videosOf(false), [2, 3]);
});

Deno.test("参照先のファイルが無ければ止まる", async () => {
  await assertRejects(
    () => buildSongAssets(contextOf("10th", []), songmapSong(1)),
    Error,
    "file1が無い",
  );
});

const job = (
  key: string,
  songIds: number[],
  file = files[1],
): Era1VideoJob => ({
  songIds,
  video: {
    archive: file.archive,
    generation: "3rd",
    key,
    offset: file.offset,
  },
});

Deno.test("era1のムービーは、採用した本だけが再符号化になる", async () => {
  const adopted = job("a", [1]);
  const context = contextOf("3rd", files, {
    era: "era1",
    era1Jobs: groupEra1Jobs([adopted]).get("3rd")!,
  });
  const route = async (videos: number[]) =>
    (await buildSongAssets(context, songmapSong(1, { videos })))
      .filter((asset) => asset.kind === "video");
  const [use] = await route([2]);
  assertEquals(use.path, "reencode");
  assertEquals(
    use.output,
    "build/intermediate/discs/3rd/video_converted/a.pss",
  );
  const [, twin] = await route([2, 3]);
  assertEquals(twin.path, "excluded");
  const [none] = await route([3]);
  assertEquals(none.path, "excluded");
});

Deno.test("採用したムービーを使わない曲は対象外になる", async () => {
  const context = contextOf("3rd", files, {
    era: "era1",
    era1Jobs: groupEra1Jobs([job("a", [9])]).get("3rd")!,
  });
  const [video] = (await buildSongAssets(
    context,
    songmapSong(1, { videos: [2] }),
  )).filter((asset) => asset.kind === "video");
  assertEquals(video.path, "excluded");
});

Deno.test("採用したムービーは作品ごとに元の位置で引ける", () => {
  const grouped = groupEra1Jobs([job("a", [1]), job("b", [2], files[2])]);
  assertEquals(grouped.get("3rd")?.size, 2);
  assertEquals(
    grouped.get("3rd")?.get(sourceKeyOf("SAMPLE.DAT", files[2].offset))?.video
      .key,
    "b",
  );
});
