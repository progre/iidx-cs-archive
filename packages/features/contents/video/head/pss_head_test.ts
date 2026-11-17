import { assertEquals, assertThrows } from "@std/assert";
import { PACK_SIZE, parseHead } from "./pss_head.ts";

/** 合成した先頭パック。system headerは付けず、PESの直後にsequence_headerを置く */
function syntheticPack(
  { height, muxRate, width }: {
    height: number;
    muxRate: number;
    width: number;
  },
): Uint8Array {
  const pack = new Uint8Array(PACK_SIZE);
  pack.set([0, 0, 1, 0xba]);
  pack[10] = (muxRate >> 14) & 0xff;
  pack[11] = (muxRate >> 6) & 0xff;
  pack[12] = (muxRate & 0x3f) << 2;
  pack[13] = 0;
  pack.set([0, 0, 1, 0xe0], 14);
  const sequence = 24;
  pack.set([0, 0, 1, 0xb3], sequence);
  pack[sequence + 4] = width >> 4;
  pack[sequence + 5] = ((width & 0x0f) << 4) | (height >> 8);
  pack[sequence + 6] = height & 0xff;
  return pack;
}

Deno.test("parseHead: 幅・高さ・多重化レートを読む", () => {
  const head = parseHead(
    syntheticPack({ height: 224, muxRate: 17280, width: 320 }),
  );
  assertEquals(head.width, 320);
  assertEquals(head.height, 224);
  assertEquals(head.muxRateKbps, 6912);
});

Deno.test("parseHead: 先頭がパックヘッダーでなければ失敗する", () => {
  assertThrows(() => parseHead(new Uint8Array(PACK_SIZE)));
});
