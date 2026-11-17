import { assertEquals } from "@std/assert";
import { metaPathOf, mp4JobOf } from "./mp4_job.ts";

Deno.test("mp4JobOf: 入力と出力の名前を決め、映像はそのまま写す", () => {
  assertEquals(mp4JobOf("out", "3rd", "pss/3rd", "X_0001.pss", "Song 1"), {
    args: [
      "-i",
      "pss/3rd/X_0001.pss",
      "-c",
      "copy",
      "out/3rd_X_0001_Song_1.mp4",
    ],
    output: "out/3rd_X_0001_Song_1.mp4",
  });
});

Deno.test("metaPathOf: PSSの名前に.jsonを付ける", () => {
  assertEquals(metaPathOf("pss/3rd", "X_0001.pss"), "pss/3rd/X_0001.pss.json");
});
