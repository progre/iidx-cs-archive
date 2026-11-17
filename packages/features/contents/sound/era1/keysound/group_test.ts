import { assertEquals, assertThrows } from "@std/assert";
import { era1GroupsOf } from "./group.ts";

Deno.test("群なしの0と255は、PBの群なしの255にする", () => {
  assertEquals(era1GroupsOf([0, 255, 3], false), [255, 255, 3]);
});

Deno.test("鳴らし直しで止める世代は、群なしの音に使われていない群を1つずつ割り当てる", () => {
  assertEquals(era1GroupsOf([0, 1, 255, 1], true), [0, 1, 2, 1]);
});

Deno.test("割り当てる群が足りなければ止める", () => {
  assertThrows(() => era1GroupsOf(Array.from({ length: 256 }, () => 0), true));
});
