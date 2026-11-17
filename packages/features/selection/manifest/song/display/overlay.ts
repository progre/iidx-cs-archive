// 曲中オーバーレイの`.if`のフィールドを、manifest形式にする。
// 素材世代とPB原盤は、TOCの位置だけが違う。両方を`sheetOverlayOf`が扱う。
// PB形式へ組み直すのは`layout/display_prepare/lap/overlay/prepare.ts`である。

import type {
  ManifestOverlay,
  ManifestOverlayPackage,
  ManifestOverlayPair,
} from "@csa/core";
import { data1Slice, type Data1Toc } from "./data1.ts";

/** 曲DBから読んだ、9th以降のオーバーレイのフィールド */
export interface SheetOverlayFields {
  /** 空枠を除いた、読み込むDATA1 indexの一覧 */
  packages: readonly number[];
  /** 枠の位置を保った組。DATA1 indexが空の組はnullである */
  pairs: readonly ({ animation: number; index: number } | null)[];
}

/**
 * 組をmanifest形式にする。`label`は、エラーの文章に出す曲の名前である。
 * PBの抽選枠は7つなので、`drawLimit`(PBの組の数)を超えて溢れた組は落とす。
 * 素材の枠数がPBの8枠より多い世代があるので、後ろの空枠も落とす。
 */
export function sheetOverlayOf(
  label: string,
  fields: SheetOverlayFields,
  toc: Data1Toc,
  drawLimit: number,
): ManifestOverlay | undefined {
  if (fields.packages.length === 0) {
    return undefined;
  }
  const pairs: (ManifestOverlayPair | null)[] = fields.pairs.map((pair) => {
    if (pair === null) {
      return null;
    }
    const packageIndex = fields.packages.indexOf(pair.index);
    if (packageIndex < 0) {
      throw new Error(`${label} の組が一覧に無い${pair.index}を指す`);
    }
    return { animation: pair.animation, packageIndex };
  });
  let drawn = 0;
  for (let i = 1; i < pairs.length; i++) {
    if (pairs[i] === null) {
      continue;
    }
    if (drawn < drawLimit - 1) {
      drawn++;
    } else {
      pairs[i] = null;
    }
  }
  while (pairs.length > 0 && pairs[pairs.length - 1] === null) {
    pairs.pop();
  }
  return {
    packages: fields.packages.map((index) => data1Slice(label, index, toc)),
    pairs,
  };
}

/** 3rd〜8thで、曲のオーバーレイが入っている主アーカイブの`IFs`1本 */
export interface LegacyOverlayFile {
  archive: string;
  offset: number;
  serial: number;
  size: number;
}

/** `IFs`を持たない曲のtileが埋め込まれた、ELFの本を示す名前とanimation */
export interface ElfTile {
  animation: number;
  archive: string;
}

/**
 * 3rd〜8thのオーバーレイをmanifest形式にする。
 * 組は枠の位置を保つ。示すanimation番号は詰めた後の値である。
 * 枠を1つも使わない曲は`undefined`を返す。
 * tileの入れ物は、`fileOf`が`IFs`を返せば、主アーカイブの`IFs`1本である。
 * `fileOf`が`null`を返す曲(6thの44曲)は、tileがELFに埋め込まれているので、ELFのtileを実際のデータとして使う。
 * ELFのtileは番号を持たないため、枠が示すanimationで区別する。
 * 同じ組の曲は1本を共有する。
 */
export function legacyOverlayOf(
  animations: readonly (number | null)[],
  fileOf: () => LegacyOverlayFile | null,
  elfTile: () => ElfTile,
): ManifestOverlay | undefined {
  if (animations.length === 0) {
    return undefined;
  }
  const overlayPackage = (): ManifestOverlayPackage => {
    const file = fileOf();
    if (file === null) {
      const tile = elfTile();
      return {
        sourceArchive: tile.archive,
        sourceFileIndex: tile.animation,
        sourceOffset: 0,
        sourceSize: 0,
      };
    }
    return {
      sourceArchive: file.archive.toLowerCase(),
      sourceFileIndex: file.serial,
      sourceOffset: file.offset,
      sourceSize: file.size,
    };
  };
  return {
    packages: [overlayPackage()],
    pairs: animations.map((animation) =>
      animation === null ? null : { animation, packageIndex: 0 }
    ),
  };
}
