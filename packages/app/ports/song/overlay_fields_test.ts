import { assertEquals } from "@std/assert";
import { encodePbOverlay } from "@csa/contents-overlay";
import type { ManifestSong } from "@csa/core";
import {
  overlayIndexLookup,
  type PlacementPlan,
  plannedOverlayIndices,
  songOverlayOf,
} from "@csa/layout-iso-plan";

const overlayPackage = (sourceFileIndex: number) => ({
  sourceArchive: "data1.dat",
  sourceFileIndex,
  sourceOffset: 0,
  sourceSize: 2048,
});

const held = {
  overlay: {
    packages: [overlayPackage(400), overlayPackage(401)],
    // 枠0は空で、枠1に組を置く
    pairs: [null, { animation: 1, packageIndex: 0 }],
  },
  sourceGeneration: "djt",
  targetSongIndex: 100,
} as unknown as ManifestSong;

const empty = {
  sourceGeneration: "djt",
  targetSongIndex: 101,
} as unknown as ManifestSong;

const plan = {
  data1: {
    overlayPackages: [400, 401].map((sourceFileIndex, i) => ({
      ...overlayPackage(sourceFileIndex),
      newData1Index: 1471 + i,
      sourceGeneration: "djt",
    })),
  },
} as unknown as PlacementPlan;

const songOverlayFields = (song: ManifestSong) =>
  encodePbOverlay(
    songOverlayOf(song),
    overlayIndexLookup(song, plannedOverlayIndices(plan)),
  );

// 追加曲の枠にはクローン元の値が残るので、持たない曲も全枠を空にしないと
// 他の曲のレイヤーが出る。
Deno.test("オーバーレイの無い曲の欄は全枠0xFFFFになる", () => {
  const fields = songOverlayFields(empty);
  assertEquals(fields.packages.every((byte) => byte === 0xff), true, "一覧");
  assertEquals(fields.pairs.every((byte) => byte === 0xff), true, "組");
});

Deno.test("オーバーレイのある曲は一覧が先頭から詰まり、組が枠1に入る", () => {
  const fields = songOverlayFields(held);
  const view = new DataView(fields.packages.buffer);
  assertEquals(view.getUint16(0, true), 1471, "一覧の枠0");
  assertEquals(view.getUint16(2, true), 1472, "一覧の枠1");
  assertEquals(view.getUint16(4, true), 0xffff, "一覧の枠2");
  const pairs = new DataView(fields.pairs.buffer);
  assertEquals(pairs.getUint32(0, true), 0xffffffff, "組の枠0");
  assertEquals(pairs.getUint16(4, true), 1, "組の枠1のanimation");
  assertEquals(pairs.getUint16(6, true), 1471, "組の枠1のパッケージ");
});
