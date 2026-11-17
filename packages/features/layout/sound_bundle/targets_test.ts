import { assertEquals, assertThrows } from "@std/assert";
import type { IndividualAssetManifest } from "@csa/core";
import {
  assertDiscsDirectory,
  soundBundlePaths,
  soundBundleSummary,
  soundGenerationSummary,
  soundTargetsOf,
} from "./targets.ts";

const asset = (kind: string, sourceArchive: string) => ({
  kind,
  sourceArchive,
});

const manifest = {
  songs: [
    {
      assets: [
        asset("keysound", "kb.dat;1"),
        asset("video", "mv.dat;1"),
        asset("bgm", "__file__/bgm.bin"),
      ],
      sourceGeneration: "gen",
    },
    { assets: [asset("bgm", "bgm.dat;1")], sourceGeneration: "other" },
    { assets: [asset("bgm", "bgm2.dat;1")], sourceGeneration: "gen" },
  ],
} as unknown as IndividualAssetManifest;

Deno.test("対象は世代の曲のキー音とBGMで、動画と単体ファイルは含めない", () => {
  const targets = soundTargetsOf(manifest, "gen");
  assertEquals(
    targets.map((target) => [target.kind, target.archiveName]),
    [["keysound", "KB.DAT"], ["bgm", "BGM2.DAT"]],
  );
});

Deno.test("対象の資産は曲が持つ資産そのものである", () => {
  const [first] = soundTargetsOf(manifest, "gen");
  assertEquals(first.asset, manifest.songs[0].assets[0]);
});

Deno.test("世代の曲が無ければ対象は無い", () => {
  assertEquals(soundTargetsOf(manifest, "none"), []);
});

Deno.test("bundleの置き場はディレクトリー・世代名・source keyから決まる", () => {
  assertEquals(soundBundlePaths("dir/s", "gen"), {
    bundle: "dir/s/gen/sound.bin",
    record: "dir/s/gen/sound.json",
    settled: "dir/s/gen/sound_settled.bin",
    source: "__sound_bundle__/gen",
  });
});

Deno.test("中間ファイルの置き場以下でない置き場は例外を投げる", () => {
  assertDiscsDirectory("build/intermediate/discs");
  assertThrows(
    () => assertDiscsDirectory("build/iso/sound"),
    Error,
    "build/intermediate/以下",
  );
});

Deno.test("要約は世代ごとの件数を縦棒で繋ぐ", () => {
  const summary = soundGenerationSummary("gen", 3, [{}, {}] as never);
  assertEquals(summary, "gen converted 2 of 3");
  assertEquals(
    soundBundleSummary([summary, "other converted 0 of 1"]),
    "sound bundle: gen converted 2 of 3 | other converted 0 of 1",
  );
});
