// オーバーレイの切り替えのstubと表の語。ELFは読まない。

import { assertEquals } from "@std/assert";
import { jal, jr, reg } from "../../mips/mod.ts";
import {
  overlaySwitchStubWords,
  overlaySwitchTableWords,
  PB_OVERLAY,
} from "./stub.ts";

Deno.test("表は曲indexを並べ、-1で終える", () => {
  assertEquals(overlaySwitchTableWords([0x288, 0x2c2]), [
    0x288,
    0x2c2,
    0xffffffff,
  ]);
});

Deno.test("stubは、渡した曲indexの関数と、難易度と曲DBの関数を呼んで戻る", () => {
  const words = overlaySwitchStubWords(0x7fbdf00, 0x7fbe100);
  const calls = [
    jal(0x7fbdf00),
    jal(PB_OVERLAY.difficulty),
    jal(PB_OVERLAY.songDbBase),
    jal(PB_OVERLAY.songEntry),
  ];
  assertEquals(calls.map((call) => words.includes(call)), [
    true,
    true,
    true,
    true,
  ]);
  assertEquals(words.at(-2), jr(reg.ra));
});
