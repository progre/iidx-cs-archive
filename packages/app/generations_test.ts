// 原盤を読む素材世代の決め方。フォルダーの有無は偽の関数で与える。

import { assertEquals, assertThrows } from "@std/assert";
import { imageGenerations, skippedOf, withoutSkipped } from "./generations.ts";

Deno.test("--skip は、カンマで区切った世代を発売順に返す", () => {
  assertEquals(skippedOf("us, 3rd"), ["3rd", "us"]);
  assertEquals(skippedOf(undefined), []);
});

Deno.test("--skip に PB や知らない世代を書くと止まる", () => {
  assertThrows(() => skippedOf("pb"), Error, "PB の原盤は必ず読む");
  assertThrows(() => skippedOf("11th"), Error, "素材世代ではない: 11th");
});

Deno.test("イメージを置いた世代だけを読み、PB が無ければ止まる", () => {
  const folders = { "3rd": "A", "4th": "B", pb: "P" };
  const has = (folder: string) => folder !== "B";
  assertEquals(imageGenerations(folders, has), ["3rd"]);
  assertThrows(
    () => imageGenerations(folders, (folder) => folder === "A"),
    Error,
    "PB の原盤のイメージファイルが無い",
  );
});

Deno.test("外す世代を除く", () => {
  assertEquals(withoutSkipped(["3rd", "us", "emp"], ["us"]), ["3rd", "emp"]);
});
