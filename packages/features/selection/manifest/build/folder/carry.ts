// 全世代の曲DBを行として並べ、管理名ごとの作品番号を集める。
// どの値を採るかは`rules.ts`が決める。ここは並べて集めるだけにする。

import type { ManifestSongDraft } from "@csa/core";
import type { IndexDoc } from "../../index/mod.ts";

/** 作品番号を決めるときに読む、曲DBの1エントリの値 */
export type CarriedSong = Pick<
  ManifestSongDraft,
  | "canonicalKey"
  | "catalogLine"
  | "newOld"
  | "sourceGeneration"
  | "sourceSongIndex"
  | "sourceVersion"
>;

/** 管理名 → 作品番号 → その作品番号を使っている引き継ぎ元の世代 */
export type FolderCarry = ReadonlyMap<string, ReadonlyMap<number, string[]>>;

/** 世代 → その世代に載っている曲の管理名とsong_id */
export type SongsByGeneration = ReadonlyMap<
  string,
  readonly { key: string; songId: number }[]
>;

/** 世代ごとの、その世代に載っている曲の管理名とsong_id */
export function songsByGeneration(index: IndexDoc): SongsByGeneration {
  const byGeneration = new Map<string, { key: string; songId: number }[]>();
  for (const [key, song] of Object.entries(index.songs)) {
    for (const [generation, entries] of Object.entries(song.generations)) {
      const rows = byGeneration.get(generation) ?? [];
      rows.push(...entries.map((entry) => ({ key, songId: entry.song_id })));
      byGeneration.set(generation, rows);
    }
  }
  return byGeneration;
}

/** 曲DBのバイトを世代とsong_idで読む。位置の分からない世代の曲は`undefined`を返す */
export type ByteReader = (
  generation: string,
  songId: number,
) => number | undefined;

/** 索引にある全世代の全曲を行にする */
export function songRows(
  songs: SongsByGeneration,
  versionAt: ByteReader,
  newOldAt: ByteReader,
): CarriedSong[] {
  return [...songs].flatMap(([generation, rows]) =>
    rows.map(({ key, songId }): CarriedSong => ({
      canonicalKey: key,
      sourceGeneration: generation,
      newOld: newOldAt(generation, songId),
      sourceSongIndex: songId,
      sourceVersion: versionAt(generation, songId),
    }))
  );
}

/**
 * その世代で旧曲の印が付く曲の管理名。
 * 3rdの旧曲は2nd以前が初出なので、同じ管理名の曲もそこを既定にできる。
 * 印を読めない曲は旧曲に数えない。
 */
export function oldSongKeys(
  generation: string,
  songs: SongsByGeneration,
  newOldAt: ByteReader,
  markedVersion: (generation: string, mark: number) => number | undefined,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const { key, songId } of songs.get(generation) ?? []) {
    const raw = newOldAt(generation, songId);
    if (raw !== undefined && markedVersion(generation, raw) === undefined) {
      keys.add(key);
    }
  }
  return keys;
}

/** 行ごとの作品番号を、管理名ごとに集める。`versionOf`が決められない行は集めない */
export function folderCarry(
  rows: readonly CarriedSong[],
  versionOf: (row: CarriedSong) => number | undefined,
): FolderCarry {
  const carry = new Map<string, Map<number, string[]>>();
  for (const row of rows) {
    const version = versionOf(row);
    if (version === undefined) {
      continue;
    }
    const versions = carry.get(row.canonicalKey) ?? new Map<number, string[]>();
    versions.set(version, [
      ...(versions.get(version) ?? []),
      row.sourceGeneration,
    ]);
    carry.set(row.canonicalKey, versions);
  }
  return carry;
}
