import { assertEquals, assertThrows } from "@std/assert";
import { type DiscImage, generatedSourceArchive } from "@csa/core";
import { assetSourceKey, OpenAssetSources } from "./asset_sources.ts";

Deno.test("原盤のアーカイブは世代と小文字の名前で引き、生成物は鍵のまま引く", () => {
  assertEquals(assetSourceKey("9th", "DATA1.DAT;1"), "9th/data1.dat");
  assertEquals(
    assetSourceKey("9th", generatedSourceArchive("file", "a")),
    "__file__/a",
  );
  const chart = generatedSourceArchive("chartBundle", "9th");
  assertEquals(assetSourceKey("10th", chart), "__pb_chart_bundle__/9th");
});

Deno.test("ファイルを持たない素材は、鍵ごとに開き、閉じるまで共有する", async () => {
  let opened = 0;
  let closed = 0;
  const image = {
    close: () => closed++,
  } as unknown as DiscImage;
  const sources = await OpenAssetSources.open(
    new Map([["a", { open: () => (opened++, image) }]]),
  );
  assertEquals(sources.get("a").image, image);
  assertEquals(opened, 1);
  sources.close();
  assertEquals(closed, 1);
});

Deno.test("引けない素材は例外にする", async () => {
  const sources = await OpenAssetSources.open(new Map());
  assertThrows(() => sources.get("x"), Error, "資産sourceが無い");
});
