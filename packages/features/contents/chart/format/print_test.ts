// 譜面の中身のハッシュを、F1形式のバイト列を自分で組み立てて見る。原盤は読まない。
import { assertEquals, assertNotEquals } from "@std/assert";
import { chartPrintOf } from "./print.ts";

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

const TIMING = [0, 8, 0, 0xf0];

Deno.test("tick を換算しても、ノーツの並びと判定の値が同じなら同じハッシュになる", () => {
  const chart = f1Chart([TIMING, [10, 0, 1, 0], [20, 0, 2, 0], [20, 1, 3, 0]]);
  const scaled = f1Chart([TIMING, [15, 0, 1, 0], [30, 1, 3, 0], [30, 0, 2, 0]]);
  assertEquals(chartPrintOf(chart, "F1"), chartPrintOf(scaled, "F1"));
});

Deno.test("判定の値だけが違えば、ノーツのハッシュは同じで、全体のハッシュは違う", () => {
  const notes = [[10, 0, 1, 0], [20, 0, 2, 0]];
  const a = chartPrintOf(f1Chart([TIMING, ...notes]), "F1");
  const b = chartPrintOf(f1Chart([[0, 8, 0, 0xf1], ...notes]), "F1");
  assertEquals(a.notes, b.notes);
  assertNotEquals(a.all, b.all);
});

Deno.test("ノーツの並びが違えば、ノーツのハッシュも違う", () => {
  const a = chartPrintOf(f1Chart([TIMING, [10, 0, 1, 0]]), "F1");
  const b = chartPrintOf(f1Chart([TIMING, [10, 0, 2, 0]]), "F1");
  assertNotEquals(a.notes, b.notes);
});
