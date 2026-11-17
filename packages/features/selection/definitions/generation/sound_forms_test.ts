import { assertEquals, assertThrows } from "@std/assert";
import { eraOf, keysoundFormOf } from "./generations.ts";
import { checkBgmForm, checkKeysoundForm } from "./sound_forms.ts";

Deno.test("世代名から era を引く", () => {
  assertEquals(eraOf("3rd"), "era1");
  assertEquals(eraOf("8th"), "era1");
  assertEquals(eraOf("9th"), "era2");
  assertEquals(eraOf("red"), "era2");
  assertEquals(eraOf("hs"), "era3");
  assertEquals(eraOf("emp"), "era3");
  assertThrows(() => eraOf("unknown"), Error, "定義が無い世代");
  assertThrows(() => eraOf("pb"), Error, "eraが未登録の世代");
});

Deno.test("キー音の形式はeraと一致しない世代がある", () => {
  assertEquals(keysoundFormOf("7th"), "headerless");
  assertEquals(keysoundFormOf("10th"), "ef1");
  assertEquals(keysoundFormOf("red"), "wp2");
  assertEquals(keysoundFormOf("hs"), "wp2");
  assertEquals(keysoundFormOf("djt"), "wp3");
});

Deno.test("世代の期待どおりのキー音形式は通し、食い違えば止める", () => {
  assertEquals(checkKeysoundForm("7th", "headerless"), "headerless");
  assertThrows(() => checkKeysoundForm("djt", "ef1"), Error, "wp3のはず");
  assertThrows(() => checkKeysoundForm("red", "ef1"), Error, "wp2のはず");
});

Deno.test("eraの期待どおりのBGM形式は通し、食い違えば止める", () => {
  assertEquals(checkBgmForm("era1", "bigendian"), "bigendian");
  assertEquals(checkBgmForm("era3", "vig"), "vig");
  assertThrows(() => checkBgmForm("era1", "vig"), Error, "bigendian");
  assertThrows(() => checkBgmForm("era2", "bigendian"), Error, "vig");
});
