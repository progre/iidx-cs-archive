import { assertEquals } from "@std/assert";
import {
  generatedSourceArchive,
  type GeneratedSourceKind,
  parseGeneratedSource,
} from "./source_key.ts";

Deno.test("生成物の出どころの名前は、接頭辞に名前を続けた文字列を返す", () => {
  assertEquals(
    generatedSourceArchive("chartBundle", "9th"),
    "__pb_chart_bundle__/9th",
  );
  assertEquals(
    generatedSourceArchive("soundBundle", "9th"),
    "__sound_bundle__/9th",
  );
  assertEquals(generatedSourceArchive("file", "a/b.bin"), "__file__/a/b.bin");
});

Deno.test("作った名前から、種類と名前を読み取れる", () => {
  const kinds: GeneratedSourceKind[] = ["chartBundle", "soundBundle", "file"];
  for (const kind of kinds) {
    assertEquals(
      parseGeneratedSource(generatedSourceArchive(kind, "a/b;1")),
      { kind, name: "a/b;1" },
    );
  }
});

Deno.test("原盤のアーカイブ名は生成物でないのでnullになる", () => {
  assertEquals(parseGeneratedSource("DATA1.DAT"), null);
  assertEquals(parseGeneratedSource("data1.dat;1"), null);
  assertEquals(parseGeneratedSource(""), null);
  assertEquals(parseGeneratedSource("x__file__/a"), null);
});
