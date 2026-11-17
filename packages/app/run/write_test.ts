import { assertEquals } from "@std/assert";
import {
  generatedSourceArchive,
  type IndividualAssetManifest,
} from "@csa/core";
import { manifestAssetSources } from "./write.ts";

const manifest = {
  sources: { "9th": {}, "10th": {} },
  songs: [{
    assets: [{ sourceArchive: generatedSourceArchive("file", "x/asset.bin") }],
    overlay: {
      packages: [{
        sourceArchive: generatedSourceArchive("file", "x/overlay.if"),
      }],
    },
    titleCard: { sourceArchive: "DATA1.DAT" },
  }],
} as unknown as IndividualAssetManifest;

Deno.test("音のbundleと単体ファイルはパスで、譜面bundleは開く関数で引く", () => {
  const sources = manifestAssetSources(
    manifest,
    new Map([["__sound_bundle__/9th", "s.bin"]]),
    () => {
      throw new Error("開かない");
    },
    new Uint8Array(),
  );
  assertEquals(
    Object.fromEntries(
      [...sources].map(([key, source]) => [
        key,
        "path" in source ? source.path : "open",
      ]),
    ),
    {
      "__sound_bundle__/9th": "s.bin",
      "__file__/x/asset.bin": "x/asset.bin",
      "__file__/x/overlay.if": "x/overlay.if",
      [generatedSourceArchive("chartBundle", "9th")]: "open",
      [generatedSourceArchive("chartBundle", "10th")]: "open",
    },
  );
});
