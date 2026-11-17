import { assertEquals, assertThrows } from "@std/assert";
import { GHOST_TABLE_SONG_LIMIT, ghostTablePatches } from "./mod.ts";
import { rivalMenuStub } from "./rival_menu.ts";

Deno.test("自分の表は、ライバルの使用の印の手前まで1089曲入る", () => {
  assertEquals(GHOST_TABLE_SONG_LIMIT, 1089);
});

/** `slti v0, a0, 1`。即値だけが替わることを見る */
const SLTI = () => 0x28820001;

Deno.test("自分の表を初期化するループの上限を曲数にする", () => {
  const limit = ghostTablePatches(994, SLTI).find((patch) =>
    patch.address === 0x173634
  );
  assertEquals(limit?.csa, 0x288203e2);
});

Deno.test("入りきらない曲数ではビルドを止める", () => {
  assertThrows(() => ghostTablePatches(1090, SLTI));
});

Deno.test("ライバルのメニューは、名前の変更の項目でなければ決定を無視する", () => {
  assertEquals(rivalMenuStub(), [
    0x8f838768, // lw v1, -0x7898(gp)
    0x8c630014, // lw v1, 0x14(v1)
    0x2463fffe, // addiu v1, v1, -2
    0x14600003, // bne v1, zero, ignore
    0,
    0x0804c124, // j 0x130490
    0,
    0x03e00008, // ignore: jr ra
    0x00001025, // move v0, zero
  ]);
});
