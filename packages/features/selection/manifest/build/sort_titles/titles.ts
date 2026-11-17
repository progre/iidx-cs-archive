// 曲DBに書く題名を、選曲リストの曲名順に使う題名にする。
// 実機は題名を並べ替えと頭文字フォルダーにしか使わず、画面には出さない。
// そのため、同じ曲の別の版の`edition`や、版を並べる順番の数字を題名の後ろに足しても、見た目は変わらない。

import type { IndexTitleOf } from "../../index/mod.ts";

/** 題名を決める1曲。PB原盤の曲は`listed`が真で、`fiveKeyOf`を持たない */
export interface TitledSong {
  /** 曲の全曲リストの行の`edition`。同じ曲の別の版として、土台の名前の後ろに足す */
  edition?: string;
  /** 5鍵盤版なら、表の曲の`世代:song_id` */
  fiveKeyOf?: string;
  generation: string;
  /** 曲の全曲リストの行の`index_title`。行が分からない曲は持たず、曲番号で引く */
  indexTitle?: string | null;
  /** 同じ曲の版をまとめるキー */
  key: string;
  /** 選曲リストに並ぶか。裏エントリーは並ばない */
  listed: boolean;
  songId: number;
  /** 曲DBの今の題名 */
  title: string;
}

/** 題名の欄はNUL終端を含めて0x40バイトである */
const MAX_TITLE_BYTES = 0x3f;
/** 版の順番の前に置く。空白は表示できる文字のうち最も小さいので、2つ重ねると土台の直後に並ぶ */
const VERSION_SEPARATOR = "  ";

export const songIdOf = (generation: string, songId: number) =>
  `${generation}:${songId}`;

/** 表にする版を選ぶ順。pb、新しい世代の順で、us は最後にする */
const frontRankOf = (generations: readonly string[]) => (generation: string) =>
  generation === "pb"
    ? generations.length
    : generation === "us"
    ? -1
    : generations.indexOf(generation);

/** 表のほかの版の順。古い世代から並べ、us は最後にする */
const restRankOf = (generations: readonly string[]) => (generation: string) =>
  generation === "us" ? generations.length : generations.indexOf(generation);

function assertFits(title: string, id: string): void {
  if (!/^[\x20-\x7e]+$/.test(title) || title.length > MAX_TITLE_BYTES) {
    throw new Error(`${id}の曲名順の題名が曲DBの欄に入らない: ${title}`);
  }
}

/**
 * `songs`は追加する曲、`pbSongs`はPB原盤の曲である。全曲リストに`index_title`があれば、その名前を使う。
 * 追加する曲のうち、題名が変わる曲の題名を`世代:song_id`で返す
 */
export function sortTitlesOf(
  songs: readonly TitledSong[],
  pbSongs: readonly TitledSong[],
  indexTitleOf: IndexTitleOf,
  generations: readonly string[],
): Map<string, string> {
  const frontRank = frontRankOf(generations);
  const restRank = restRankOf(generations);
  const idOf = (song: TitledSong) => songIdOf(song.generation, song.songId);
  // PB原盤の曲の題名は書き換えないので、ほかの版の土台にも曲DBの題名を使う
  const nameOf = (song: TitledSong) =>
    (pbSongs.includes(song)
      ? song.title
      : (song.indexTitle !== undefined
        ? song.indexTitle
        : indexTitleOf(song.generation, song.songId)) ?? song.title)
      .toUpperCase();
  const listed = [...pbSongs, ...songs].filter((song) =>
    song.listed && song.fiveKeyOf === undefined
  );
  const resolved = new Map<string, string>();
  const byNewest = (songs: readonly TitledSong[]) =>
    songs.toSorted((a, b) => frontRank(b.generation) - frontRank(a.generation));
  for (const group of Map.groupBy(listed, (song) => song.key).values()) {
    const name = nameOf(byNewest(group)[0]);
    for (
      const editions of Map.groupBy(group, ({ edition }) => edition).values()
    ) {
      const [front, ...rest] = byNewest(editions);
      const base = front.edition === undefined
        ? name
        : name + VERSION_SEPARATOR + front.edition.toUpperCase();
      resolved.set(idOf(front), base);
      rest
        .toSorted((a, b) => restRank(a.generation) - restRank(b.generation))
        .forEach((song, i) =>
          resolved.set(idOf(song), base + VERSION_SEPARATOR + (i + 1))
        );
    }
  }
  for (const song of songs.filter((each) => each.fiveKeyOf !== undefined)) {
    const front = resolved.get(song.fiveKeyOf!);
    if (front !== undefined) {
      resolved.set(idOf(song), front);
    }
  }
  const changed = songs.filter((song) =>
    resolved.has(idOf(song)) && resolved.get(idOf(song)) !== song.title
  );
  return new Map(changed.map((song) => {
    const title = resolved.get(idOf(song))!;
    assertFits(title, idOf(song));
    return [idOf(song), title];
  }));
}
