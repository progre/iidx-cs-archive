// 実行: deno test packages/features/layout/display_prepare/repack_test.ts
// 並べ替えの依頼と、置いたファイルへの差し替えを確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { INTERMEDIATE_DIRECTORY, type ManifestSong } from "@csa/core";
import { recordOverlayPath } from "./legacy_songs.ts";
import { packageFilePath } from "./split/mod.ts";
import {
  assertIntermediateDirectory,
  ifDirectoryOf,
  ifFileNameOf,
  ifFilePathOf,
  overlayRepackRequests,
  titleCardRepackRequest,
  unusedIfLine,
  withRepackedOverlay,
  withRepackedTitleCard,
} from "./repack.ts";

const DATA = "data1.dat";
const slice = (fileIndex: number, archive = DATA) => ({
  sourceArchive: archive,
  sourceFileIndex: fileIndex,
  sourceOffset: 16,
  sourceSize: 2048,
});

const song = (generation: string, archive = DATA): ManifestSong => ({
  assets: [],
  canonicalKey: "song",
  entry: "",
  overlay: { packages: [slice(3, archive), slice(4, archive)], pairs: [] },
  sourceGeneration: generation,
  sourceSongIndex: 0,
  targetSongIndex: 1,
  title: "song",
  titleCard: { ...slice(7, archive), pairs: [] },
  videoFields: [],
});

const sources = {
  dataArchive: DATA,
  descriptorStartOf: (generation: string) => generation === "10th" ? 4 : null,
} as const;

Deno.test("記述子が+4の世代だけ、曲名カードの依頼を返す", () => {
  assertEquals(titleCardRepackRequest(song("pb"), sources), null);
  assertEquals(titleCardRepackRequest(song("10th"), sources), {
    descriptorStart: 4,
    fileIndex: 7,
    generation: "10th",
    sourceOffset: 16,
    sourceSize: 2048,
  });
});

Deno.test("素材のDATA1以外にある曲名カードは依頼にしない", () => {
  assertThrows(() => titleCardRepackRequest(song("10th", "x.if"), sources));
});

Deno.test("オーバーレイは本ごとに依頼を返し、差し替え後も並びを保つ", () => {
  const requests = overlayRepackRequests(song("10th"), sources);
  assertEquals(requests?.map((r) => r.fileIndex), [3, 4]);
  const replaced = withRepackedOverlay(song("10th"), [
    { archive: "a", size: 1 },
    { archive: "b", size: 2 },
  ]);
  assertEquals(
    replaced.overlay?.packages.map((p) => [p.sourceArchive, p.sourceSize]),
    [["a", 1], ["b", 2]],
  );
  assertEquals(overlayRepackRequests(song("pb"), sources), null);
});

Deno.test("曲名カードの差し替えは、通し番号を保ち位置を0へ戻す", () => {
  const replaced = withRepackedTitleCard(song("10th"), {
    archive: "f",
    size: 4096,
  });
  assertEquals(replaced.titleCard?.sourceFileIndex, 7);
  assertEquals(replaced.titleCard?.sourceOffset, 0);
  assertEquals(replaced.titleCard?.sourceSize, 4096);
});

Deno.test("分ける本の実体は、単体ファイルならそのパス、DATA1ならnull", () => {
  const files = new Map([["__file__/a.if", "out/a.if"]]);
  assertEquals(packageFilePath(slice(1), files, DATA), null);
  assertEquals(
    packageFilePath(slice(1, "__file__/a.if"), files, DATA),
    "out/a.if",
  );
  assertThrows(() => packageFilePath(slice(1, "__file__/b.if"), files, DATA));
});

Deno.test("同じ鍵が別のパスを指すと止まる", () => {
  const paths = new Map<string, string>();
  recordOverlayPath(paths, "3rd", slice(1), "a.if");
  recordOverlayPath(paths, "3rd", slice(1), "a.if");
  assertThrows(() => recordOverlayPath(paths, "3rd", slice(1), "b.if"));
});

Deno.test("置き場は、世代と種類のフォルダーを重ねる", () => {
  assertEquals(ifDirectoryOf("d", "9th", "overlays"), "d/9th/overlays");
  assertEquals(ifDirectoryOf("d", "red", "title_cards"), "d/red/title_cards");
});

Deno.test("連番は4桁に揃え、桁が増えてもそのまま書く", () => {
  assertEquals(ifFileNameOf(7), "0007");
  assertEquals(ifFileNameOf(12345), "12345");
  assertEquals(
    ifFilePathOf("d/9th/overlays", "0007_1"),
    "d/9th/overlays/0007_1.if",
  );
});

Deno.test("中間フォルダーの外は拒む", () => {
  assertIntermediateDirectory(`${INTERMEDIATE_DIRECTORY}/discs`);
  assertThrows(() => assertIntermediateDirectory("out/discs"));
  assertThrows(() => assertIntermediateDirectory(INTERMEDIATE_DIRECTORY));
});

Deno.test("使わなかった.ifの行は、削除した件数を書く", () => {
  assertEquals(unusedIfLine(2), "unused .if written in laps: 2");
});
