// 書き出したイメージを開き直し、計画した全点を読み戻す。
// 資産は件数が多いが、抜き取りにせず全件を原盤と突き合わせる。
// 抜き取りでは、1件だけoffsetを間違えても気づけず、実機で初めて見つかるからである。

import { type DiscImage, SEC } from "@csa/core";
import {
  bytesEqual,
  FileDiscImage,
  readExact,
  sameRange,
  verifySourcePatches,
} from "../../image/mod.ts";
import {
  type ByteWrite,
  type MetadataPatch,
  metadataWrites,
} from "../../volume/mod.ts";
import { assetSourceKey, OpenAssetSources } from "../asset_sources.ts";
import type { ImageInput, ImagePlan } from "../image_input.ts";
import { verifyData1TitleCards } from "./verify_data1.ts";
import { type RegionWindows, verifySourceRegion } from "./verify_region.ts";

/** 他の features が持つ検査。呼び出し側が渡す */
export interface VerifyTools extends RegionWindows {
  /** 読み戻したELFの内蔵ファイル表を検査する */
  checkElf: (elf: Uint8Array) => void;
}

async function verifyMetadata(
  image: DiscImage,
  writes: readonly ByteWrite[],
): Promise<void> {
  for (const write of writes) {
    const actual = new Uint8Array(write.bytes.length);
    await readExact(image, write.offset, actual);
    if (!bytesEqual(actual, write.bytes)) {
      throw new Error(
        `ISO9660の書き換えが読み戻せない: 0x${write.offset.toString(16)}`,
      );
    }
  }
}

async function verifyElf(
  image: DiscImage,
  elf: ImageInput["elfPlacement"],
  expected: Uint8Array,
  checkElf: (elf: Uint8Array) => void,
): Promise<void> {
  const actual = new Uint8Array(expected.length);
  await readExact(image, elf.lba * SEC, actual);
  if (!bytesEqual(actual, expected)) {
    throw new Error("追記したELFが一致しない");
  }
  checkElf(actual);
}

async function verifyAssets(
  image: DiscImage,
  assets: OpenAssetSources,
  plan: ImagePlan,
  log: (line: string) => void,
): Promise<void> {
  for (const placement of plan.placements) {
    const assetSource = assets.get(
      assetSourceKey(placement.sourceGeneration, placement.sourceArchive),
    );
    if (
      !await sameRange(
        image,
        placement.lba * SEC,
        assetSource.image,
        placement.sourceOffset,
        placement.sourceSize,
      )
    ) {
      throw new Error(`abc[${placement.newAbcIndex}]の資産が一致しない`);
    }
  }
  log(`read back ${plan.placements.length} new assets by absolute LBA`);
}

/** `source`は、周回で開いたPBの原盤。原盤領域の照合に使い、ここでは閉じない */
export async function verifyImage(
  input: ImageInput,
  metadata: readonly MetadataPatch[],
  tools: VerifyTools,
  log: (line: string) => void,
  source: DiscImage,
): Promise<void> {
  const image = await FileDiscImage.open(input.outputPath);
  const assets = await OpenAssetSources.open(input.assetSources);
  try {
    const volumeSectors = input.elfPlacement.volumeSectors;
    const size = image.size;
    if (size !== volumeSectors * SEC) {
      throw new Error(`出力長${size}が計画${volumeSectors * SEC}と違う`);
    }
    const writes = metadataWrites(metadata, volumeSectors);
    await verifyMetadata(image, writes);
    await verifyElf(
      image,
      input.elfPlacement,
      input.elfBytes,
      tools.checkElf,
    );
    await verifyAssets(image, assets, input.plan, log);
    await verifyData1TitleCards(image, input.plan, assets, log);
    await verifySourcePatches(image, input.sourcePatches);
    const sampled = await verifySourceRegion(
      image,
      source,
      input,
      writes,
      tools,
    );
    log(`read back the source area in ${sampled} windows`);
  } finally {
    assets.close();
    image.close();
  }
}
