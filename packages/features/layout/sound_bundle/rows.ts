// 変換した音を1本のbundleへ並べる記録。bundleのバイト列は書かず、位置の採番だけを決める。
import { generatedSourceArchive, type ManifestAsset } from "@csa/core";

export type SoundKind = "bgm" | "keysound";

export interface SoundBundleRow {
  kind: SoundKind;
  offset: number;
  size: number;
  /** era1キー音の旧→新 `entry_id`。同じ曲の譜面 `sound_id` の書き換えに使う */
  soundMap?: Record<string, number>;
  sourceFileIndex: number;
  sourceSize: number;
}

export interface SoundTarget {
  asset: ManifestAsset;
  kind: SoundKind;
  /** 原盤のISOに置かれたアーカイブの名前 */
  archiveName: string;
}

export interface ConvertedSize {
  size: number;
  soundMap?: Record<string, number>;
}

export class SoundBundleRows {
  readonly rows: SoundBundleRow[] = [];

  constructor(private readonly generation: string) {}

  /**
   * 変換して中身が変わった音を、bundleの`offset`にある音として記録する。
   * 資産は、原盤ではなくbundle内の位置を参照するよう書き換える。
   */
  add(
    target: SoundTarget,
    converted: ConvertedSize,
    offset: number,
  ): SoundBundleRow {
    const { asset, kind } = target;
    const row: SoundBundleRow = {
      kind,
      soundMap: converted.soundMap,
      sourceFileIndex: asset.sourceFileIndex,
      sourceSize: asset.sourceSize,
      offset,
      size: converted.size,
    };
    this.rows.push(row);
    asset.sourceArchive = generatedSourceArchive(
      "soundBundle",
      this.generation,
    );
    asset.sourceOffset = offset;
    asset.sourceSize = row.size;
    return row;
  }

  /**
   * 変換して変わらなかった音を、原盤から写したbundleの`offset`へ向ける。
   * 原盤の同じ範囲を指す資産には同じ`offset`を渡すので、それらの資産は同じ場所を指したままになる。行は作らない。
   */
  addUnchanged(target: SoundTarget, size: number, offset: number): void {
    const { asset } = target;
    asset.sourceArchive = generatedSourceArchive(
      "soundBundle",
      this.generation,
    );
    asset.sourceOffset = offset;
    asset.sourceSize = size;
  }
}

/** 世代の素材ファイル番号 → era1キー音の旧→新 `entry_id`。譜面の変換に渡す */
export const soundMapsOf = (
  rows: readonly SoundBundleRow[],
): Map<number, Record<string, number>> =>
  new Map(
    rows.flatMap((row) =>
      row.soundMap === undefined ? [] : [[row.sourceFileIndex, row.soundMap]]
    ),
  );
