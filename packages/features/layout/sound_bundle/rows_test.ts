import { assertEquals } from "@std/assert";
import type { ManifestAsset } from "@csa/core";
import { SoundBundleRows, soundMapsOf, type SoundTarget } from "./rows.ts";

const target = (sourceFileIndex: number, sourceSize: number): SoundTarget => ({
  archiveName: "A.DAT",
  asset: {
    kind: "keysound",
    references: [],
    sourceArchive: "a.dat;1",
    sourceFileIndex,
    sourceOffset: 7,
    sourceSize,
  } as ManifestAsset,
  kind: "keysound",
});

Deno.test("変換して変わった音は、渡した位置にある音として記録する", () => {
  const rows = new SoundBundleRows("gen");
  const first = rows.add(target(1, 100), { size: 40 }, 0);
  const second = rows.add(target(2, 200), { size: 60 }, 40);
  assertEquals([first.offset, first.size], [0, 40]);
  assertEquals([second.offset, second.size], [40, 60]);
});

Deno.test("並べた音の資産はbundleの位置と大きさを指す", () => {
  const rows = new SoundBundleRows("gen");
  const moved = target(1, 100);
  rows.add(moved, { size: 40 }, 8);
  assertEquals(moved.asset.sourceArchive, "__sound_bundle__/gen");
  assertEquals(moved.asset.sourceOffset, 8);
  assertEquals(moved.asset.sourceSize, 40);
});

Deno.test("行は変換前の大きさを残す", () => {
  const rows = new SoundBundleRows("gen");
  const row = rows.add(target(1, 100), { size: 40 }, 0);
  assertEquals(row.sourceSize, 100);
  assertEquals(row.sourceFileIndex, 1);
});

Deno.test("変わらなかった音は、行を作らず、bundleの位置を指す", () => {
  const rows = new SoundBundleRows("gen");
  const same = target(1, 100);
  const other = target(2, 100);
  rows.addUnchanged(same, 100, 30);
  rows.addUnchanged(other, 100, 30);
  assertEquals(rows.rows, []);
  assertEquals(same.asset.sourceArchive, "__sound_bundle__/gen");
  assertEquals([same.asset.sourceOffset, same.asset.sourceSize], [30, 100]);
  assertEquals(same.asset, { ...other.asset, sourceFileIndex: 1 });
});

Deno.test("entry_idの対応は、持つ行だけをファイル番号で引ける", () => {
  const rows = new SoundBundleRows("gen");
  rows.add(target(1, 100), { size: 40, soundMap: { "3": 5 } }, 0);
  rows.add(target(2, 100), { size: 40 }, 40);
  assertEquals([...soundMapsOf(rows.rows)], [[1, { "3": 5 }]]);
});
