// 周回で書いた曲名カードとオーバーレイの記録を読み書きする。I/Oだけを行う。

import type { LapDisplaySong } from "./lap_songs.ts";

/** 周回で整えた曲名カードとオーバーレイ。次のビルドの周回は、入力が同じならこの記録を使う */
export interface DisplayLapRecord {
  /** 置いた`.if` */
  files: string[];
  /** 世代の収録の候補を JSON にしたもの。これが同じなら、周回の結果も同じになる */
  input: string;
  /** `<世代>/<曲番号>`と、整えた曲名カードとオーバーレイの組 */
  songs: [string, LapDisplaySong][];
}

/** 記録が無ければ`undefined` */
export function readDisplayLapRecord(
  path: string,
): DisplayLapRecord | undefined {
  try {
    return JSON.parse(Deno.readTextFileSync(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

export function writeDisplayLapRecord(
  path: string,
  record: DisplayLapRecord,
): void {
  Deno.writeTextFileSync(path, JSON.stringify(record));
}

/** 記録を消す。`.if`を書き始める前に消し、書き終えるまで記録が残らないようにする */
export function removeDisplayLapRecord(path: string): void {
  try {
    Deno.removeSync(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

export function fileExists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}
