// 曲中オーバーレイのフィールドをmanifest形式にする判断と、DATA1の範囲の計算。
// 実行: deno test packages/features/selection/manifest/song/overlay_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import { data1Slice, type Data1Toc } from "./data1.ts";
import { legacyOverlayOf, sheetOverlayOf } from "./overlay.ts";

const toc: Data1Toc = {
  archive: "data1.dat",
  count: 10,
  rowOf: (fileIndex) => ({ count: fileIndex === 9 ? 0 : 2, sector: fileIndex }),
};

Deno.test("DATA1の範囲はセクタ数に2048を掛ける", () => {
  assertEquals(data1Slice("x", 3, toc), {
    sourceArchive: "data1.dat",
    sourceFileIndex: 3,
    sourceOffset: 3 * 2048,
    sourceSize: 2 * 2048,
  });
});

Deno.test("TOCの外のファイルと、セクタ数が0のファイルは止まる", () => {
  assertThrows(() => data1Slice("x", 10, toc), Error, "不正");
  assertThrows(() => data1Slice("x", 9, toc), Error, "セクタ数が0");
});

Deno.test("一覧に無いファイルを示す組は止まる", () => {
  assertThrows(
    () =>
      sheetOverlayOf(
        "x",
        { packages: [1], pairs: [{ animation: 0, index: 2 }] },
        toc,
        8,
      ),
    Error,
    "一覧に無い",
  );
});

Deno.test("一覧が空ならオーバーレイを持たない", () => {
  assertEquals(
    sheetOverlayOf("x", { packages: [], pairs: [null] }, toc, 8),
    undefined,
  );
});

Deno.test("組は枠の位置を保ち、後ろの空枠だけを落とす", () => {
  const overlay = sheetOverlayOf(
    "x",
    {
      packages: [4, 5],
      pairs: [
        { animation: 7, index: 5 },
        null,
        { animation: 8, index: 4 },
        null,
      ],
    },
    toc,
    8,
  );
  assertEquals(overlay?.pairs, [
    { animation: 7, packageIndex: 1 },
    null,
    { animation: 8, packageIndex: 0 },
  ]);
  assertEquals(overlay?.packages.map((each) => each.sourceFileIndex), [4, 5]);
});

Deno.test("先頭の枠を除き、抽選枠の数を超えた組は落とす", () => {
  const pairs = [1, 2, 3, 4].map((animation) => ({ animation, index: 1 }));
  const overlay = sheetOverlayOf("x", { packages: [1], pairs }, toc, 3);
  assertEquals(
    overlay?.pairs.map((pair) => pair?.animation ?? null),
    [1, 2, 3],
  );
});

Deno.test("3rd〜8thのオーバーレイは、IFsがあれば主アーカイブのデータを実際に使う", () => {
  const overlay = legacyOverlayOf(
    [5, null],
    () => ({ archive: "DATA.DAT", offset: 10, serial: 3, size: 20 }),
    () => {
      throw new Error("使ってはならない");
    },
  );
  assertEquals(overlay, {
    packages: [{
      sourceArchive: "data.dat",
      sourceFileIndex: 3,
      sourceOffset: 10,
      sourceSize: 20,
    }],
    pairs: [{ animation: 5, packageIndex: 0 }, null],
  });
});

Deno.test("IFsが無い曲は、ELFのtileを実際のデータとして使う", () => {
  const overlay = legacyOverlayOf(
    [5],
    () => null,
    () => ({ animation: 5, archive: "elf#a5" }),
  );
  assertEquals(overlay?.packages, [{
    sourceArchive: "elf#a5",
    sourceFileIndex: 5,
    sourceOffset: 0,
    sourceSize: 0,
  }]);
});

Deno.test("枠を1つも使わない曲はオーバーレイを持たない", () => {
  assertEquals(
    legacyOverlayOf([], () => null, () => ({ animation: 0, archive: "" })),
    undefined,
  );
});
