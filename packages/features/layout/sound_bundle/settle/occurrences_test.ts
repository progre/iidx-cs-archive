import { assertEquals } from "@std/assert";
import type { ManifestAsset } from "@csa/core";
import { SoundOccurrences } from "./settle.ts";
import type { SoundTarget } from "../rows.ts";

const target = (sourceOffset: number): SoundTarget => ({
  archiveName: "A.DAT",
  asset: {
    sourceArchive: "A.DAT;1",
    sourceOffset,
    sourceSize: 4,
  } as ManifestAsset,
  kind: "bgm",
});

Deno.test("変わらなかった音が同じ範囲を指すとき、2つ目から書かない", () => {
  const log = new SoundOccurrences();
  assertEquals(log.add(target(0), { size: 4 }, true), true);
  assertEquals(log.add(target(0), { size: 4 }, true), false);
  assertEquals(log.add(target(8), { size: 4 }, true), true);
  assertEquals(log.list.map((each) => each.sameAs), [undefined, 0, undefined]);
});

Deno.test("変わった音は、同じ範囲でも毎回書く", () => {
  const log = new SoundOccurrences();
  assertEquals(log.add(target(0), { size: 6 }, false), true);
  assertEquals(log.add(target(0), { size: 6 }, false), true);
  assertEquals(log.list.map((each) => each.sameAs), [undefined, undefined]);
});

Deno.test("先に変わった音があっても、変わらない音の最初の位置を覚える", () => {
  const log = new SoundOccurrences();
  log.add(target(0), { size: 6 }, false);
  log.add(target(0), { size: 4 }, true);
  log.add(target(0), { size: 4 }, true);
  assertEquals(log.list.map((each) => each.sameAs), [undefined, undefined, 1]);
});
