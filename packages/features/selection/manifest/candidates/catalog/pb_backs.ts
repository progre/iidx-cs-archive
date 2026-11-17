// 表を PB 以外の版にした組の、PB 原盤の曲の写しの裏を集め、表の曲の下書きに PB の枠を書く。
// PB 原盤の曲は manifest の曲にならないので、写しは曲DBの枠の写しとして扱う。

import type {
  CatalogRow,
  CatalogVariant,
  ManifestPbBack,
  ManifestSongDraft,
} from "@csa/core";
import { songIdOf } from "./variants.ts";

/** PB 原盤の曲の写しの裏。`songId`は PB の曲の song_id で、表の曲を置く枠でもある */
export interface LapPbBack {
  position: number;
  songId: number;
}

export const isPbBack = (variant: CatalogVariant): boolean =>
  variant.generation === "pb";

/** すべての世代を読み終えた後に、PB の写しの裏を集め、その表の曲の下書きに`pbSlot`を書く */
export function withPbSlotFronts(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  variants: readonly CatalogVariant[],
): { pbBacks: LapPbBack[]; rowsOf: Map<string, ManifestSongDraft[]> } {
  const result = new Map([...rowsOf].map(([gen, rows]) => [gen, [...rows]]));
  const pbBacks = variants.filter(isPbBack).map((variant) => {
    const where = `pbの全曲リスト line ${variant.line}`;
    if (variant.position === undefined) {
      throw new Error(`${where}: PB原盤の曲は、選んで出す裏にしかできない`);
    }
    const songId = songIdOf(catalogRows.get("pb"), variant.title, where);
    const front = songIdOf(
      catalogRows.get(variant.frontGeneration),
      variant.frontTitle,
      where,
    );
    const rows = result.get(variant.frontGeneration) ?? [];
    const at = rows.findIndex((row) =>
      row.sourceSongIndex === front && row.variantOf === undefined
    );
    if (at < 0) {
      throw new Error(`${where}: 表の曲が行に無い`);
    }
    rows[at] = { ...rows[at], pbSlot: songId };
    result.set(variant.frontGeneration, rows);
    return { position: variant.position, songId };
  });
  return { pbBacks, rowsOf: result };
}

/**
 * PB 原盤の曲の写しの裏に、裏の枠の番号を振る。裏の枠は、manifest の裏の曲の後ろに続ける。
 * 表の曲が PB の枠に置かれていなければ、写しは指されないので止める
 */
export function pbBacksOf(
  backs: readonly LapPbBack[],
  songs: readonly { targetSongIndex: number; variantOf?: unknown }[],
  targetSongCount: number,
): ManifestPbBack[] {
  const variants = songs.filter((song) => song.variantOf !== undefined).length;
  return backs.map((back, index) => {
    if (!songs.some((song) => song.targetSongIndex === back.songId)) {
      throw new Error(`PB原盤のsong${back.songId}の枠に、表の曲が載らない`);
    }
    return { ...back, targetSongIndex: targetSongCount + variants + index };
  });
}

/** 表の曲を置いた PB の枠を、PB の枠ごとの値(レベル・作品番号・ムービーの差し替え)から外す */
export function pbSlotFilter(backs: readonly LapPbBack[]) {
  const taken = new Set(backs.map(({ songId }) => songId));
  return {
    keepsPbSong: ({ song }: { song: { generation: string; songId: number } }) =>
      song.generation !== "pb" || !taken.has(song.songId),
    untaken: <T extends { songIndex: number }>(values: T[]): T[] =>
      values.filter(({ songIndex }) => !taken.has(songIndex)),
  };
}
