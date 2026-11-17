// 裏エントリーと5鍵盤版の、表の曲。曲リストの「裏エントリー」の列に、条件と表の曲の世代と管理名を出す。
// 表の曲は manifest の枠番号で引く。
// 表の曲が PB 原盤の曲のときは manifest に無いので、PB の曲の管理名を使う。
// 曲リストでは、裏エントリーと5鍵盤版の行を表の曲の行の直後に並べる。

import type { ManifestSong } from "@csa/core";
import type { VariantFor } from "../../types.ts";

type Song = Pick<
  ManifestSong,
  | "canonicalKey"
  | "fiveKeyOf"
  | "sourceGeneration"
  | "sourceSongIndex"
  | "targetSongIndex"
  | "variantOf"
>;

/** 5鍵盤版の条件名 */
export const FIVE_KEYS = "5keys";

/** `pbKeys`はPBの曲index → 管理名 */
export function variantForOf(
  songs: readonly Song[],
  pbKeys: ReadonlyMap<number, string>,
): (song: Song) => VariantFor | undefined {
  const frontAt = new Map(
    songs.map((song) => [
      song.targetSongIndex,
      {
        front: song.canonicalKey,
        frontGeneration: song.sourceGeneration,
        frontSongId: song.sourceSongIndex,
      },
    ]),
  );
  return (song) => {
    const front = song.variantOf ?? song.fiveKeyOf;
    if (front === undefined) {
      return undefined;
    }
    const pbKey = pbKeys.get(front.targetSongIndex);
    // PB原盤の曲は、曲indexとsong_idが同じである
    const found = frontAt.get(front.targetSongIndex) ??
      (pbKey === undefined ? undefined : {
        front: pbKey,
        frontGeneration: "pb",
        frontSongId: front.targetSongIndex,
      });
    if (found === undefined) {
      throw new Error(
        `${song.canonicalKey}の表の曲index ${front.targetSongIndex}が無い`,
      );
    }
    const position = song.variantOf?.position;
    return {
      ...found,
      frontIndex: front.targetSongIndex,
      ...(position === undefined ? {} : { position }),
      rule: song.variantOf?.rule ?? FIVE_KEYS,
    };
  };
}

interface GroupedRow {
  generation: string;
  removed: boolean;
  /** 選曲リストに並ぶ行の曲index。表の曲の行を引くのに使う */
  saveIndex?: number;
  songId: number;
  variantFor?: VariantFor;
}

/** 表の曲の直後に並べる順。裏を番号の順に並べ、5鍵盤版は最後にする */
const attachedOrderOf = ({ position, rule }: VariantFor) =>
  rule === FIVE_KEYS ? Infinity : position ?? -1;

/**
 * 曲名順に並べた行のうち、裏エントリーと5鍵盤版の行を表の曲の行の直後へ移す。
 * 次の行は動かさない
 * - 外した曲(`exclude`)の行
 * - 表の曲の行が曲リストに無い行
 */
export function withFrontsFirst<T extends GroupedRow>(rows: readonly T[]): T[] {
  // 表になれるのは、選曲リストの行と5鍵盤版の行である。裏は表を曲indexで指す。
  // 全曲リストで2行に書いた曲は、同じ`世代:song_id`の行が2つあるので、曲番号では表を決められない
  const canFront = (row: T) =>
    !row.removed && row.saveIndex !== undefined &&
    (row.variantFor === undefined || row.variantFor.rule === FIVE_KEYS);
  const ids = new Set(rows.filter(canFront).map((row) => row.saveIndex));
  const frontIdOf = (row: T) => {
    const front = row.variantFor;
    if (row.removed || front === undefined) {
      return undefined;
    }
    return ids.has(front.frontIndex) ? front.frontIndex : undefined;
  };
  const attached = Map.groupBy(
    rows.filter((row) => frontIdOf(row) !== undefined),
    (row) => frontIdOf(row)!,
  );
  // 裏エントリーには、5鍵盤版の曲を差し替え元にするものがある。それは5鍵盤版の行の直後に並べる
  const withAttached = (row: T): T[] => [
    row,
    ...(canFront(row) && attached.get(row.saveIndex!) || [])
      .toSorted((a, b) =>
        attachedOrderOf(a.variantFor!) - attachedOrderOf(b.variantFor!)
      )
      .flatMap(withAttached),
  ];
  const grouped = rows.filter((row) => frontIdOf(row) === undefined).flatMap(
    withAttached,
  );
  if (grouped.length !== rows.length) {
    throw new Error(
      `並べ替えで行の数が変わった: ${rows.length} → ${grouped.length}`,
    );
  }
  return grouped;
}

/**
 * 組は全曲リストの曲名だけで作るので、同じ名前の別の曲が組に入ると、表とフォルダーが食い違う。
 * その場合は止めて、`index_title`で分けさせる。表の行は、裏が持つ表の曲indexで引く
 */
export function assertBackFolders(
  rows: readonly (GroupedRow & { folder: string })[],
): void {
  const fronts = new Map(
    rows
      .filter((row) =>
        !row.removed && row.saveIndex !== undefined &&
        (row.variantFor === undefined || row.variantFor.rule === FIVE_KEYS)
      )
      .map((row) => [row.saveIndex, row.folder]),
  );
  const mismatched = rows.flatMap((row) => {
    const front = row.variantFor;
    if (row.removed || front === undefined || front.rule === FIVE_KEYS) {
      return [];
    }
    const folder = fronts.get(front.frontIndex);
    return folder === undefined || folder === row.folder ? [] : [
      `${row.generation}:${row.songId}(${row.folder}) → ` +
      `${front.frontGeneration}:${front.frontSongId}(${folder})`,
    ];
  });
  if (mismatched.length > 0) {
    throw new Error(
      `表の曲とフォルダーが違う裏の曲: ${mismatched.join(", ")}`,
    );
  }
}
