// 元イメージをそのまま複製し、終端に新規資産、DATA1追記、加工ELFの順に連続して配置する。
// 原盤のLBAとA/B/Cは動かさない。そのため、既存の参照は全て残る。
// どの曲からも参照されなくなった原盤の領域には、複製した後で、新規資産を上書きする。
// 新規資産は、ABC表の絶対LBA(タグ3)で読まれる。

import { type DiscImage, SEC } from "@csa/core";
import {
  createImageSinkFile,
  FileDiscImage,
  ImageWriter,
} from "../image/mod.ts";
import { type MetadataPatch, metadataWrites } from "../volume/mod.ts";
import { assetSourceKey, OpenAssetSources } from "./asset_sources.ts";
import type { ImageInput } from "./image_input.ts";
import { applySourcePatches, patchAt } from "./patch_image.ts";

/** `source`は、周回で開いたPBの原盤。複製と原盤領域の差し替えに使い、ここでは閉じない */
export async function writeImage(
  input: ImageInput,
  metadata: readonly MetadataPatch[],
  log: (line: string) => void,
  source: DiscImage,
): Promise<void> {
  const plan = input.plan;
  const assets = await OpenAssetSources.open(input.assetSources);
  const output = await createImageSinkFile(input.outputPath);
  try {
    const writer = new ImageWriter(output, log);
    await writer.copy(source, 0, input.sourceVolumeSectors * SEC);
    if (writer.position !== plan.assetRange.startLba * SEC) {
      throw new Error("新規資産の開始位置が計画と違う");
    }
    for (const placement of plan.reused) {
      const assetSource = assets.get(
        assetSourceKey(placement.sourceGeneration, placement.sourceArchive),
      );
      await writer.copyOver(
        placement.lba * SEC,
        assetSource.image,
        placement.sourceOffset,
        placement.sourceSize,
      );
    }
    log(`new assets in freed source ranges: ${plan.reused.length}`);
    for (const placement of plan.appended) {
      const assetSource = assets.get(
        assetSourceKey(placement.sourceGeneration, placement.sourceArchive),
      );
      await writer.padTo(placement.lba * SEC);
      await writer.copy(
        assetSource.image,
        placement.sourceOffset,
        placement.sourceSize,
      );
    }
    await writer.padTo(plan.assetRange.endLba * SEC);
    log(
      `new assets: ${plan.appended.length} ${
        (plan.assetRange.endLba - plan.assetRange.startLba) * SEC
      } bytes @ ${plan.assetRange.startLba}..${plan.assetRange.endLba}`,
    );
    const data1 = plan.data1;
    if (writer.position !== data1.startLba * SEC) {
      throw new Error("DATA1追記の開始位置が計画と違う");
    }
    // 曲名カードの後ろへオーバーレイが続く。どちらも素材の範囲をそのまま写す
    for (const file of data1.copiedFiles) {
      const source = assets.get(
        assetSourceKey(file.sourceGeneration, file.sourceArchive),
      );
      await writer.padTo(file.lba * SEC);
      await writer.copy(
        source.image,
        file.sourceOffset,
        file.sourceSize,
      );
    }
    for (const imageSet of data1.imageSets) {
      await writer.padTo(imageSet.lba * SEC);
      using file = await FileDiscImage.open(imageSet.path);
      await writer.copy(file, 0, imageSet.size);
    }
    await writer.padTo(data1.endLba * SEC);
    log(
      `DATA1: title cards ${data1.titleCardCount} + overlays ` +
        `${data1.overlayPackageCount} + image sets ` +
        `${data1.imageSets.length} @ ` +
        `${data1.startLba}..${data1.endLba}`,
    );
    const elf = input.elfPlacement;
    if (writer.position !== elf.lba * SEC) {
      throw new Error("ELF開始位置が計画と違う");
    }
    await writer.bytes(input.elfBytes);
    await writer.padTo(elf.volumeSectors * SEC);
    log(
      `ELF: ${input.elfBytes.length} bytes @ ${elf.lba}..${elf.volumeSectors}`,
    );

    for (const write of metadataWrites(metadata, elf.volumeSectors)) {
      await patchAt(output, write.offset, write.bytes);
    }
    await applySourcePatches(source, output, input.sourcePatches);
    for (const patch of input.sourcePatches) {
      log(`${patch.name}: ${patch.replacement.length} bytes @ ${patch.offset}`);
    }
  } finally {
    output.close();
    assets.close();
  }
}
