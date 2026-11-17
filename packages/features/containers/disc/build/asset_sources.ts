// ISO に写す素材の出どころを開く。周回で書いたファイルと、読むたびに作る譜面bundleだけを指し、原盤は開かない。

import { type DiscImage, parseGeneratedSource } from "@csa/core";
import { FileDiscImage } from "../image/mod.ts";

/**
 * 素材。ファイルは先頭から読む。
 * `open`は、ファイルを持たない素材を読める`DiscImage`にして返す。閉じるのは`OpenAssetSources`である。
 */
export type AssetSource = { path: string } | { open: () => DiscImage };

export type AssetSourceMap = ReadonlyMap<string, AssetSource>;

export interface OpenAssetSource {
  image: DiscImage;
}

/** 素材の世代とアーカイブ名から作る、資産を引くための鍵。`data1.dat`は世代間で同名になる */
export const assetSourceKey = (generation: string, archive: string) =>
  parseGeneratedSource(archive) !== null
    ? archive
    : generation + "/" + archive.toLowerCase().split(";")[0];

const imageKeyOf = (name: string, descriptor: AssetSource) =>
  "path" in descriptor ? "path:" + descriptor.path : "open:" + name;

/**
 * 複数の資産が同じファイルを使うときは、そのファイルを1回だけ開いて使い回す。
 * 譜面bundleは、ファイルとして書いていない。譜面bundleは、source key ごとに`DiscImage`を1つずつ開く。
 */
export class OpenAssetSources {
  readonly #descriptors: AssetSourceMap;
  readonly #images: Map<string, DiscImage>;

  private constructor(
    descriptors: AssetSourceMap,
    images: Map<string, DiscImage>,
  ) {
    this.#descriptors = descriptors;
    this.#images = images;
  }

  static async open(descriptors: AssetSourceMap): Promise<OpenAssetSources> {
    const images = new Map<string, DiscImage>();
    try {
      for (const [name, descriptor] of descriptors) {
        const imageKey = imageKeyOf(name, descriptor);
        if (images.has(imageKey)) {
          continue;
        }
        images.set(
          imageKey,
          "path" in descriptor
            ? await FileDiscImage.open(descriptor.path)
            : descriptor.open(),
        );
      }
      return new OpenAssetSources(descriptors, images);
    } catch (error) {
      for (const image of images.values()) image.close();
      throw error;
    }
  }

  /** 引けなければ例外にする。原盤を開いて探すことはしない */
  get(name: string): OpenAssetSource {
    const descriptor = this.#descriptors.get(name);
    if (descriptor === undefined) {
      throw new Error(`資産sourceが無い(周回で書いていない): ${name}`);
    }
    const image = this.#images.get(imageKeyOf(name, descriptor));
    if (image === undefined) {
      throw new Error(`資産sourceが開かれていない: ${name}`);
    }
    return { image };
  }

  close(): void {
    for (const image of this.#images.values()) image.close();
  }
}
