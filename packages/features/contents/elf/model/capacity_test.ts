import { assertEquals } from "@std/assert";
import { songCapacity } from "./capacity.ts";

const saveCapacityOf = (songCount: number) =>
  songCapacity({ abcNeeded: 0, data1Needed: 0, songCount, variants: 0 })
    .saveCapacity;

Deno.test("曲容量は曲数以上でS倍と5S倍を4命令で作れる最小の値", () => {
  assertEquals(saveCapacityOf(99), 99);
  assertEquals(saveCapacityOf(1000), 1023);
  assertEquals(saveCapacityOf(1090), 1536);
});
