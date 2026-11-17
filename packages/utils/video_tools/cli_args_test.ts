// 実行: deno test packages/utils/video_tools/cli_args_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import { parseExportMp4Args, parseSliceIsoFileArgs } from "./cli_args.ts";

Deno.test("mp4化の引数は、PSSのフォルダーと出力先", () => {
  assertEquals(parseExportMp4Args(["a", "b"]), { outDir: "b", pssDir: "a" });
  assertThrows(() => parseExportMp4Args(["a"]), Error, "指定する");
});

Deno.test("切り出しの引数は、位置と大きさを数値にする", () => {
  assertEquals(parseSliceIsoFileArgs(["9th", "X.DAT", "16", "32", "o.bin"]), {
    archiveName: "X.DAT",
    generation: "9th",
    offset: 16,
    outputPath: "o.bin",
    size: 32,
  });
  assertThrows(() => parseSliceIsoFileArgs(["9th"]), Error, "指定する");
});
