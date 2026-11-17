// 行の色と、収録フォルダー・裏エントリーの欄の文字。補正で変わった値は`補正前→補正後`の形にする。

import { FIVE_KEYS } from "../../data/rows/mod.ts";
import type { SongRow } from "../../types.ts";
import { correctedText } from "./text.ts";

/** 規則で枠が決まらない曲の、補正前の欄 */
const UNDECIDED = "?";

/** 上下と一緒に押すボタン */
const SHOULDERS = ["", "L1+", "R1+", "L1+R1+"];

/** 全曲リストで足した裏を選ぶボタン。`position`は0始まりの裏の番号 */
export const buttonsOf = (position: number): string =>
  `SELECT+${SHOULDERS[Math.floor(position / 2)]}${
    position % 2 === 0 ? "上" : "下"
  }`;

/**
 * 裏エントリーと5鍵盤版の欄。条件と表の曲を出し、番号のある裏には選ぶボタンも出す。
 * 表の曲の管理名が同じなら、名前を省いて世代だけを出す
 */
export function variantLines({ key, variantFor }: SongRow): string[] | null {
  if (variantFor === undefined) {
    return null;
  }
  const { front, frontGeneration, position, rule } = variantFor;
  const lines = front === key
    ? [rule + " for: " + frontGeneration]
    : [rule + " for:", frontGeneration + ":" + front];
  return position === undefined ? lines : [...lines, buttonsOf(position)];
}

/** 管理名の欄。`edition`で分けた組の曲は、管理名に`edition`を添える */
export const keyText = ({ edition, key }: SongRow): string =>
  edition === undefined ? key : `${key} (${edition})`;

/** 5鍵盤版の行の`世代:song_id`。5鍵盤版の裏エントリーを見分けるのに使う */
export const fiveKeysIdsOf = (songs: readonly SongRow[]): Set<string> =>
  new Set(
    songs
      .filter((song) => song.variantFor?.rule === FIVE_KEYS)
      .map((song) => `${song.generation}:${song.songId}`),
  );

/**
 * 行の色。外した曲は黒にする。裏エントリーは灰色、5鍵盤版は水色、5鍵盤版の裏エントリーは青にする
 */
export function rowClassOf(
  { removed, variantFor }: SongRow,
  fiveKeysIds: ReadonlySet<string>,
): string {
  if (removed) {
    return "table-dark";
  }
  if (variantFor === undefined) {
    return "";
  }
  if (variantFor.rule === FIVE_KEYS) {
    return "table-info";
  }
  const frontId = `${variantFor.frontGeneration}:${variantFor.frontSongId}`;
  return fiveKeysIds.has(frontId) ? "table-primary" : "table-secondary";
}

/** 全曲リストの`folder`列で収録フォルダーを変えた曲は、`規則→補正`の形にする */
export const folderText = (song: SongRow): string =>
  song.folderBefore === undefined
    ? song.folder
    : correctedText(song.folderBefore ?? UNDECIDED, song.folder);
