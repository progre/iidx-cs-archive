// 320x240・picture 2枚だけの合成ESで、PSS化と枚数の数え直しを確かめる。

import { assertEquals } from "@std/assert";
import { muxPss } from "../mux_pss.ts";
import { countPictures, extractVideoEs } from "../pss_structure.ts";
import { muxAndInspect } from "./mux_and_inspect.ts";

const startCode = (code: number, ...body: number[]) => [0, 0, 1, code, ...body];
const SEQUENCE_HEADER = startCode(0xb3, 0x14, 0x00, 0xf0, 0x14, 0xff, 0xff);
const I_PICTURE = startCode(0x00, 0x00, 0x08, 0xff, 0xff);
const P_PICTURE = startCode(0x00, 0x00, 0x50, 0xff, 0xff);
const es = new Uint8Array([...SEQUENCE_HEADER, ...I_PICTURE, ...P_PICTURE]);

Deno.test("ESはmuxPssの出力になり、枚数をESから数える", () => {
  const source = muxPss(es);
  const result = muxAndInspect(es, source, () => []);
  assertEquals(result.pss, source);
  assertEquals(result.pictures, 2);
  assertEquals(countPictures(extractVideoEs(result.pss)), 2);
});

Deno.test("検査の基準へ、PSSの事実を渡す", () => {
  const source = muxPss(es);
  const result = muxAndInspect(es, source, (facts) => facts);
  assertEquals(result.problems.width, 320);
  assertEquals(result.problems.height, 240);
  assertEquals(result.problems.pictures, result.problems.sourcePictures);
});
