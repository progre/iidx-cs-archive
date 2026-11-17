import { assertEquals, assertRejects } from "@std/assert";
import { encodeLz, packLzChart, planPackedChartIndex } from "../pack/mod.ts";
import { PackedChartImage } from "./packed_chart_image.ts";

const KEY = new TextEncoder().encode("0123456789abcdef");

const sequence = (length: number, step: number) =>
  Uint8Array.from({ length }, (_, i) => (i * step + 3) & 0xff);

const charts = [
  { sourceFileIndex: 2, plain: sequence(150, 3) },
  { sourceFileIndex: 5, plain: sequence(77, 17) },
  { sourceFileIndex: 9, plain: sequence(300, 5) },
].map(({ plain, sourceFileIndex }) => ({
  lz: encodeLz(plain),
  plainSize: plain.length,
  sourceFileIndex,
}));
const packed = charts.map((chart) => packLzChart(chart, KEY));
const index = planPackedChartIndex(
  charts.map(({ plainSize, sourceFileIndex }, i) => ({
    plainSize,
    size: packed.at(i)!.length,
    sourceFileIndex,
  })),
);
const bundle = new Uint8Array(index.bundleBytes);
index.charts.forEach((row, i) => bundle.set(packed.at(i)!, row.offset));
const reads: number[] = [];
const image = new PackedChartImage(index, (sourceFileIndex) => {
  reads.push(sourceFileIndex);
  return charts.find((chart) => chart.sourceFileIndex === sourceFileIndex)!.lz;
}, KEY);

Deno.test("譜面をまたぐ範囲も、暗号化したbundleと同じ並びで読める", async () => {
  assertEquals(image.size, bundle.length);
  assertEquals(await image.readAt(0, bundle.length), bundle);
  const from = index.charts[0].size - 5;
  assertEquals(await image.readAt(from, 20), bundle.subarray(from, from + 20));
});

Deno.test("読まない譜面は暗号化せず、同じ譜面を続けて読むときは1回だけ読む", async () => {
  await image.readAt(index.charts[2].offset, 1);
  reads.length = 0;
  const row = index.charts[1];
  await image.readAt(row.offset, 4);
  await image.readAt(row.offset + 4, 4);
  assertEquals(reads, [row.sourceFileIndex]);
});

Deno.test("bundleの外は読めない", async () => {
  await assertRejects(() => image.readAt(bundle.length - 1, 2));
});
