// 追加曲ぶんのspriteを足した共有画像セット4本と、曲ごとの新sprite参照を作る。
// ここは、PBの画像セットの読み出し、周回で取り出したspriteの合成、分割を決まった順に呼ぶ。
// 素材世代の原盤は開かない。

import type { IndividualAssetManifest, TitleSpriteRef } from "@csa/core";
import { catalogImages } from "../catalog/mod.ts";
import {
  assertAllReplaced,
  assignParts,
  collectSourceRefs,
  generationsOf,
  groupSongs,
  initialSongSprites,
  neededSprites,
  PB_IMAGE_SETS,
  pointToCopied,
  pointToDrawn,
  silverFor,
} from "../title/mod.ts";
import type { ImageSetLap } from "./lap_sprites.ts";
import type { ImageSetPorts, ImageSetTypes } from "./ports.ts";

export interface TitleImageSetInput<T extends ImageSetTypes> {
  manifest: IndividualAssetManifest;
  /** 世代 → 周回で読んだ画像セットの組み立てが要るもの */
  lapOf: (generation: string) => ImageSetLap | undefined;
  /** 周回で開いたPBの原盤。共有画像セットをここから読む */
  pb: T["pb"];
  /** 原盤のELF。原盤のDATA1 TOCから共有画像セットを引く */
  pbElf: T["elf"];
  pbData1Lba: number;
}

/** 合成して書いた画像セット */
export interface ImageSetFileResult {
  data1Index: number;
  path: string;
  size: number;
  summary: string;
}

export interface TitleImageSetResult {
  /** legacyで4枠のどれかを作れず、空の絵を指す曲 */
  legacyIncomplete: string[];
  files: ImageSetFileResult[];
  /** target song index → 4画像セットのsprite参照 */
  songSprites: Map<number, TitleSpriteRef[]>;
}

function failWith(message: string): never {
  throw new Error(message);
}

function lapOrThrow<T extends ImageSetTypes>(
  input: TitleImageSetInput<T>,
  generation: string,
): ImageSetLap {
  const lap = input.lapOf(generation);
  if (lap === undefined) {
    throw new Error(`${generation}の周回で画像セットの材料を読んでいない`);
  }
  return lap;
}

export async function buildTitleImageSets<T extends ImageSetTypes>(
  ports: ImageSetPorts<T>,
  input: TitleImageSetInput<T>,
): Promise<TitleImageSetResult> {
  const { ops } = ports;
  const { cardSongs, legacySongs } = groupSongs(
    input.manifest.songs,
    ports.hasDisplayAssets,
  );
  // 全曲リストに文字を書いた枠は、その文字を描いた絵を足す。legacyは4枠とも描く
  const catalog = await catalogImages(
    ports,
    [...legacySongs, ...cardSongs],
    (generation) => lapOrThrow(input, generation).catalogRows,
  );
  const generations = generationsOf(cardSongs);
  const { sourceRefs, generationOf } = collectSourceRefs(
    cardSongs,
    (song) =>
      lapOrThrow(input, song.sourceGeneration).sourceRefs
        .get(song.sourceSongIndex) ??
        failWith(
          `${song.sourceGeneration}の曲${song.sourceSongIndex}の参照が周回に無い`,
        ),
  );
  const songSprites = initialSongSprites(sourceRefs, legacySongs);

  const files: ImageSetFileResult[] = [];
  // 新規のDATA1 indexは、原盤のTOCの件数の次から採番する
  let nextExtraIndex = ports.pbTocCount;
  for (const { kind, pb: pbIndex } of PB_IMAGE_SETS) {
    let imageSet: T["package"] = await ops.readPbImageSet(
      input.pb,
      input.pbData1Lba,
      input.pbElf,
      pbIndex,
    );
    let merged = false;
    const silver = ops.silverReferenceOf(imageSet);
    const summaries: string[] = [];
    for (const generation of generations) {
      const layout = ports.displayLayout(generation);
      const scope = {
        drawn: catalog.drawn,
        generation,
        generationOf,
        kind,
        sourceIndex: layout.imageSet[kind],
        sourceRefs,
      };
      const needed = neededSprites(scope);
      if (needed === undefined) {
        continue;
      }
      const path = lapOrThrow(input, generation).titleFiles[kind];
      if (path === undefined) {
        throw new Error(
          `${generation}の周回で${kind}のspriteを取り出していない`,
        );
      }
      const copied = ops.mergeSpriteFile(
        imageSet,
        path,
        needed,
        silverFor(generation, silver),
      );
      imageSet = copied.package;
      merged = true;
      summaries.push(`${generation} ${copied.summary}`);
      pointToCopied(songSprites, scope, pbIndex, copied.spriteMap);
    }
    const drawnEntries = await catalog.draw(kind);
    if (drawnEntries !== undefined) {
      const drawn = ops.mergeDrawnImages(
        imageSet,
        drawnEntries.map((entry) => entry.image),
      );
      imageSet = drawn.package;
      merged = true;
      summaries.push(`song catalog ${drawn.summary}`);
      pointToDrawn(
        songSprites,
        kind,
        pbIndex,
        drawnEntries,
        drawn.spriteIndices,
      );
    }
    if (!merged) {
      continue;
    }
    const split = ops.splitImageSet(imageSet);
    const parts = assignParts({
      kind,
      nextExtraIndex,
      partCount: split.parts.length,
      pbIndex,
      spriteMap: split.spriteMap,
      summaries,
    }, songSprites);
    files.push(
      ...parts.files.map((file, part) => ({
        ...file,
        ...ops.writeImageSetFile(file.data1Index, split.parts[part]),
      })),
    );
    nextExtraIndex = parts.nextExtraIndex;
  }
  assertAllReplaced(songSprites);
  return { legacyIncomplete: catalog.incomplete, files, songSprites };
}
