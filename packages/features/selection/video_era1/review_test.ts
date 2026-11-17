import { assertEquals } from "@std/assert";
import { mp4NameOf, safeName } from "./mp4_job.ts";

Deno.test("safeName: 英数字以外を_に寄せて端を落とす", () => {
  assertEquals(safeName("  A B!"), "A_B");
});

Deno.test("mp4NameOf: 曲名が空になれば untitled にする", () => {
  assertEquals(
    mp4NameOf("3rd", "X_0001.pss", "Song 1"),
    "3rd_X_0001_Song_1.mp4",
  );
  assertEquals(mp4NameOf("3rd", "X_0001.pss", "曲"), "3rd_X_0001_untitled.mp4");
});
