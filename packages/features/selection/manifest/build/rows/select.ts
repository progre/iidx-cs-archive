import type { ManifestSongDraft } from "@csa/core";
// manifestに載せる行の選抜。世代と曲数の絞り込み、裏エントリーと5鍵盤版の扱いを決める。

export interface Selection {
  /** 表が選外で落とした5鍵盤版 */
  detached: ManifestSongDraft[];
  /** 曲indexを配る順に並んだ、選曲リストに出る曲 */
  selected: ManifestSongDraft[];
  /** 選曲リストに並ばない裏エントリー。表を選んだ後で、選曲リストの範囲の外へ足す */
  variants: ManifestSongDraft[];
}

export const songKey = (row: ManifestSongDraft): string =>
  row.sourceGeneration + "/" + row.sourceSongIndex;

/**
 * 行を見分ける鍵。全曲リストで同じ曲を2行に書くと、`songKey`が同じ行が2つできる。
 * 2行とも表になることもあるので、全曲リストの行番号を鍵に入れる
 */
export const rowKey = (row: ManifestSongDraft): string =>
  songKey(row) + "@" + row.catalogLine;

/** 5鍵盤版に対応する表の曲。世代を書いていなければ、5鍵盤版と同じ世代の曲である */
export const fiveKeyKey = (row: ManifestSongDraft): string =>
  (row.fiveKeyOf?.generation ?? row.sourceGeneration) + "/" +
  (row.fiveKeyOf?.songId ?? -1);

/** 原作のムービーを置ける曲を先に採る。暫定BGAで済ます曲を最小にする */
function sortForPick(
  rows: ManifestSongDraft[],
  generationOrder: Map<string, number>,
  isPlayable: (row: ManifestSongDraft) => boolean,
): ManifestSongDraft[] {
  return rows.sort((a, b) =>
    Number(isPlayable(b)) - Number(isPlayable(a)) ||
    (generationOrder.get(a.sourceGeneration) as number) -
      (generationOrder.get(b.sourceGeneration) as number) ||
    a.sourceSongIndex - b.sourceSongIndex
  );
}

/** 曲番号の順。同じ曲を2行に書いた曲は、全曲リストの行番号の順にする */
const bySongIndex = (a: ManifestSongDraft, b: ManifestSongDraft): number =>
  a.sourceSongIndex - b.sourceSongIndex ||
  (a.catalogLine ?? 0) - (b.catalogLine ?? 0);

/**
 * 1世代の行を、manifestに載る順に並べる。表か裏かは周回の後に決まるので、並びに使わない。
 * 選外で載らない行があっても、載る行の並びはこの並びの部分列になる。
 */
export const manifestOrderOfGeneration = (
  rows: readonly ManifestSongDraft[],
): ManifestSongDraft[] =>
  rows.filter((song) => song.excluded === undefined).toSorted(bySongIndex);

/** manifestの曲の並び。世代ごとに`manifestOrderOfGeneration`と同じ並びにする */
export const manifestOrderOf = <T extends ManifestSongDraft>(
  songs: readonly T[],
  generations: readonly string[],
): T[] =>
  songs.toSorted((a, b) =>
    generations.indexOf(a.sourceGeneration) -
      generations.indexOf(b.sourceGeneration) || bySongIndex(a, b)
  );

export interface SelectionInput {
  /** 載せる行 */
  buildable: readonly ManifestSongDraft[];
  /** 世代名を発売順に並べたもの */
  generations: readonly string[];
  /** 原作のムービーをそのまま置けるか */
  isPlayable: (row: ManifestSongDraft) => boolean;
}

export function selectSongs(input: SelectionInput): Selection {
  const { buildable, isPlayable } = input;
  const generationOrder = new Map(
    input.generations.map((generation, i) => [generation, i]),
  );
  // 5鍵盤版の中には、収録しない行を表のエントリーとして参照するものがある。
  // その5鍵盤版は、下のdetachedの計算で外れる。
  // 裏エントリーが参照する表のエントリーを収録しないときは、その裏エントリーも収録しない。
  // 裏エントリーは、links.ts の `plannedSongs` で除く。
  const eligible = sortForPick(
    buildable.filter((song) => song.variantOf === undefined),
    generationOrder,
    isPlayable,
  );
  // 5鍵盤版はレベル欄を表から写すので、表が選外なら曲として成り立たない。
  // PB原盤の曲は候補に入らないが、常に載る
  const eligibleKeys = new Set(eligible.map(songKey));
  const detached = eligible.filter((row) =>
    row.fiveKeyOf !== undefined && row.fiveKeyOf.generation !== "pb" &&
    !eligibleKeys.has(fiveKeyKey(row))
  );
  return {
    detached,
    selected: eligible.filter((row) => !detached.includes(row)),
    variants: buildable.filter((song) => song.variantOf !== undefined),
  };
}

/** 曲DBの曲数。99はPBの固定枠の数 */
export const targetSongCountOf = (songCount: number): number => 99 + songCount;
