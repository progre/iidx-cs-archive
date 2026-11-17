// MPEG-PSの判定とffmpegの引数。ffmpegは呼ばない。

import { assertEquals } from "@std/assert";
import { isMpegPs, muxArgs, squareArgs } from "./mpeg_ps.ts";

Deno.test("パックヘッダーで始まるバイト列だけをMPEG-PSとみなす", () => {
  assertEquals(isMpegPs(Uint8Array.of(0, 0, 1, 0xba, 0x44)), true);
  assertEquals(isMpegPs(Uint8Array.of(0, 0, 1, 0xb3)), false);
  assertEquals(isMpegPs(Uint8Array.of(0, 0, 1)), false);
});

Deno.test("表示比の書き換えは、全ストリームを写したまま正方画素にする", () => {
  const args = squareArgs();
  assertEquals(args.slice(args.indexOf("-c"), args.indexOf("-c") + 2), [
    "-c",
    "copy",
  ]);
  assertEquals(
    args.at(args.indexOf("-bsf:v") + 1),
    "mpeg2_metadata=display_aspect_ratio=1/1",
  );
  assertEquals(args.at(-1), "pipe:1");
});

Deno.test("mkvへの入れ替えは、全ストリームを写して出力先へ書く", () => {
  const args = muxArgs("out/a.mkv");
  assertEquals(args.includes("-bsf:v"), false);
  assertEquals(args.slice(-3), ["-c", "copy", "out/a.mkv"]);
});
