import { type DiscImage, SEC } from "@csa/core";
import {
  bytesEqual,
  FileDiscImage,
  readExact,
  sameRange,
} from "../../image/mod.ts";
import { assetSourceKey, type OpenAssetSources } from "../asset_sources.ts";
import type { ImagePlan } from "../image_input.ts";

async function readBytes(
  file: DiscImage,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  const buffer = new Uint8Array(length);
  await readExact(file, offset, buffer);
  return buffer;
}

/** 追記した曲名カードとオーバーレイの全件を素材と突き合わせる */
export async function verifyData1TitleCards(
  image: DiscImage,
  plan: ImagePlan,
  assets: OpenAssetSources,
  log: (line: string) => void,
): Promise<void> {
  const data1 = plan.data1;
  for (const file of data1.copiedFiles) {
    const source = assets.get(
      assetSourceKey(file.sourceGeneration, file.sourceArchive),
    );
    const [actual, expected] = await Promise.all([
      readBytes(image, file.lba * SEC, file.sourceSize),
      readBytes(
        source.image,
        file.sourceOffset,
        file.sourceSize,
      ),
    ]);
    if (!bytesEqual(actual, expected)) {
      throw new Error(`DATA1[${file.newData1Index}]の中身が一致しない`);
    }
  }
  for (const imageSet of data1.imageSets) {
    using file = await FileDiscImage.open(imageSet.path);
    if (
      file.size !== imageSet.size ||
      !await sameRange(image, imageSet.lba * SEC, file, 0, imageSet.size)
    ) {
      throw new Error(`画像セット${imageSet.data1Index}が一致しない`);
    }
  }
  log(
    `DATA1: read back title cards ${data1.titleCardCount}, overlays ` +
      `${data1.overlayPackageCount}, image sets ` +
      `${data1.imageSets.length}`,
  );
}
