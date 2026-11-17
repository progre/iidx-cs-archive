// era1の音量の系統が、PB用バンクのゲインの種別へ写ることを合成した旧バンクで確かめる。

import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { repackEra1Keysound } from "./repack.ts";
import { oldBank } from "./testing.ts";

/** 表の位置`position`の行の先頭 */
const rowAt = (position: number) => 0x10 + position * 0x10;

/** 振り直した`entry_id`の行の`+0x02`(ゲインの種別) */
const gainTypeAt = (bytes: Uint8Array, entryId: number) =>
  bytes[rowAt(entryId - 1) + 0x02];

Deno.test("音量の系統1の音はゲインの種別1になり、gain_type1がgain_type0にそろう", () => {
  const { bytes, soundMap } = repackEra1Keysound(oldBank([2, 10]));
  assertEquals(gainTypeAt(bytes, soundMap["5"]), 0);
  assertEquals(gainTypeAt(bytes, soundMap["6"]), 1);
  assertEquals(bytes[0x08], 92);
  assertEquals(bytes[0x09], 92);
});

Deno.test("系統1を持たないバンクはgain_type1を変えない", () => {
  const { bytes } = repackEra1Keysound(oldBank([2, 2]));
  assertEquals(bytes[0x08], 92);
  assertEquals(bytes[0x09], 80);
});

Deno.test("PBで表せない音量の系統2は変換を止める", () => {
  assertThrows(
    () => repackEra1Keysound(oldBank([2, 0x12])),
    Error,
    "音量の系統 2",
  );
});

Deno.test("entry_idは3から連番に振り直し、旧entry_idとの対応を返す", () => {
  const { soundMap } = repackEra1Keysound(oldBank([2, 2]));
  assertEquals(soundMap, { "5": 3, "6": 4 });
});

Deno.test("keepEntryIdsは旧entry_idを保ち、表の穴を埋草で埋める", () => {
  const { bytes, soundMap } = repackEra1Keysound(oldBank([2, 2]), {
    keepEntryIds: true,
  });
  const dv = new DataView(bytes.buffer);
  assertEquals(soundMap, { "5": 5, "6": 6 });
  // 位置2は穴の埋草で音量0、位置4は旧entry_id 5の実音
  assertEquals(dv.getUint32(rowAt(2) + 0x0c, true), 0);
  assertNotEquals(dv.getUint32(rowAt(4) + 0x0c, true), 0);
});

Deno.test("優先度は、原作のドライバーが比べる100で割った余りを書く", () => {
  const old = oldBank([2]);
  new DataView(old.buffer).setUint16(0x20 + 0x02, 250, true);
  const { bytes } = repackEra1Keysound(old);
  // 実音は位置2(entry_id 3)の行
  assertEquals(bytes[rowAt(2)], 50);
});
