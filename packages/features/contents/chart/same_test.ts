// 譜面の形の求め方を、F1形式のバイト列を自分で組み立てて見る。原盤は読まない。
import { assertEquals, assertThrows } from "@std/assert";
import { chartShapeOf } from "./same.ts";

/** F1形式(4バイト/イベント・16bit tick)の譜面。`[tick, cmd, p4, c2]`を並べ、終端を足す */
const f1Chart = (events: number[][]) =>
  new Uint8Array([
    ...events.flatMap(([tick, cmd, p4, c2]) => [
      tick & 0xff,
      tick >> 8,
      cmd | (p4 << 4),
      c2,
    ]),
    0xff,
    0x7f,
    0,
    0,
  ]);

Deno.test("ノーツだけを、鍵盤ごとに tick の順で集める。判定のイベントは含めない", () => {
  const shape = chartShapeOf(
    f1Chart([[0, 8, 0, 0xf0], [100, 0, 1, 0], [50, 0, 1, 0], [60, 1, 2, 0]]),
    "F1",
  );
  assertEquals(shape, { keys: { "0.1": [50, 100], "1.2": [60] } });
});

Deno.test("イベントが途中で切れた譜面は例外にする", () => {
  assertThrows(() => chartShapeOf(new Uint8Array(12), "F3"));
});
