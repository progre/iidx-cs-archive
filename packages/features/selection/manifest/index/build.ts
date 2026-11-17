// 世代別の曲の一覧から、曲名で世代を横断する索引を作る。

import type {
  IndexDoc,
  IndexGenerationEntry,
  IndexInput,
  IndexSongEntry,
  IndexSource,
  IndexTitleOf,
} from "./types.ts";

/** NFKCで正規化して大文字にし、文字と数字だけを残す。日本語の文字も残るので、日本語の題名のキーは空にならない */
export function titleKeyOf(title: string): string {
  return [...title.normalize("NFKC").toUpperCase()]
    .filter((char) => /^[\p{L}\p{N}]$/u.test(char))
    .join("");
}

/** 符号位置の順に比べる。JavaScriptの既定の並びはUTF-16の順なので、補助面の文字で食い違う */
export function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a, (char) => char.codePointAt(0) ?? 0);
  const right = Array.from(b, (char) => char.codePointAt(0) ?? 0);
  const common = Math.min(left.length, right.length);
  for (let i = 0; i < common; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return left.length - right.length;
}

function entryOf(song: IndexSource): IndexGenerationEntry {
  return {
    song_id: song.song_id,
    charts: song.charts,
    keysound: song.keysound,
    bgm: song.bgm,
    videos: song.videos,
  };
}

/** 曲の索引のキー。全曲リストに索引の曲名があればそれを、無ければ題名を使う。題名が空白だけなら空文字 */
export function indexKeyOf(
  generation: string,
  song: Pick<IndexSource, "song_id" | "title">,
  indexTitleOf: IndexTitleOf,
): string {
  return titleKeyOf(indexTitleOf(generation, song.song_id) ?? song.title);
}

/**
 * 同じ世代に同じキーの曲が複数ある場合があるので、世代ごとの値は常に配列にする。
 * 数字だけのキーはオブジェクトに入れると並びが変わるので、途中はMapで持つ。
 */
export function buildSongIndex(
  inputs: readonly IndexInput[],
  indexTitleOf: IndexTitleOf,
): IndexDoc {
  const songs = new Map<string, IndexSongEntry>();
  for (const { generation, songs: list } of inputs) {
    for (const song of list) {
      const key = indexKeyOf(generation, song, indexTitleOf);
      if (key === "") {
        continue;
      }
      const slot = songs.get(key) ??
        { titles: [], generations: {} } satisfies IndexSongEntry;
      songs.set(key, slot);
      if (!slot.titles.includes(song.title)) {
        slot.titles.push(song.title);
      }
      (slot.generations[generation] ??= []).push(entryOf(song));
    }
  }
  const sorted = [...songs].sort(([a], [b]) => compareCodePoints(a, b));
  return {
    generations: inputs.map((input) => input.generation),
    songs: Object.fromEntries(sorted),
  };
}
