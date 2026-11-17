import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import {
  copiedVideoLine,
  copiedVideosOf,
  type CopyAsset,
  copyKey,
  type CopyLap,
  copyPathOf,
  placeCopiedVideos,
} from "./placement.ts";

const asset = (over: Partial<CopyAsset>): CopyAsset => ({
  kind: "video",
  path: "copy",
  sourceArchive: "A.DAT;1",
  sourceFileIndex: 1,
  sourceOffset: 4,
  sourceSize: 8,
  ...over,
});

Deno.test("写す映像は、種別と経路で選ぶ", () => {
  const assets = [
    asset({}),
    asset({ path: "reencode" }),
    asset({ kind: "bgm" }),
  ];
  assertEquals(copiedVideosOf(assets).length, 1);
});

Deno.test("鍵は、アーカイブの綴り・位置・大きさで決まる", () => {
  assertEquals(copyKey(asset({})), "A.DAT;1|4|8");
  assertEquals(
    copyKey(asset({ sourceArchive: "a.dat;1" })) === copyKey(asset({})),
    false,
  );
});

Deno.test("ファイルの名前は、鍵が違えば違う", () => {
  const a = copyPathOf("d", "9th", asset({}));
  assertEquals(a, "d/9th/video_copy/A.DAT_1_4_8.bin");
  assertEquals(a === copyPathOf("d", "9th", asset({ sourceSize: 9 })), false);
});

const manifestOf = (assets: unknown[]): IndividualAssetManifest =>
  ({
    songs: [{ sourceGeneration: "9th", title: "t", assets }],
  }) as unknown as IndividualAssetManifest;

const lapOf = (...paths: [CopyAsset, string, number][]): CopyLap => ({
  generation: "9th",
  files: new Map(
    paths.map(([slice, path, size]) => [copyKey(slice), { path, size }]),
  ),
  reused: 0,
});

Deno.test("原盤を指す映像を、書いたファイルへ向け、使わないファイルを返す", () => {
  const used = asset({});
  const extra = asset({ sourceOffset: 100 });
  const placed = placeCopiedVideos(
    manifestOf([{ ...used }, { ...used }]),
    new Map([["9th", lapOf([used, "p/a.bin", 8], [extra, "p/b.bin", 8])]]),
  );
  const [first, second] = placed.manifest.songs[0].assets;
  assertEquals(first.sourceArchive, "__file__/p/a.bin");
  assertEquals([first.sourceOffset, first.sourceSize], [0, 8]);
  assertEquals(first, second);
  assertEquals(placed.unused, ["p/b.bin"]);
  assertEquals(placed.used, 1);
});

Deno.test("周回で書いていない映像は例外にする", () => {
  assertThrows(
    () => placeCopiedVideos(manifestOf([asset({})]), new Map()),
    Error,
    "周回で書かれていない",
  );
});

Deno.test("生成物の資産は、付け替えない", () => {
  const generated = asset({ sourceArchive: "__sound_bundle__/9th" });
  const placed = placeCopiedVideos(manifestOf([generated]), new Map());
  assertEquals(placed.manifest.songs[0].assets[0] as unknown, generated);
});

Deno.test("写す映像の行は、使った本数と使わない本数を並べる", () => {
  assertEquals(copiedVideoLine(3, 1), "copied videos: used 3 / unused 1");
});
