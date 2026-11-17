// 全曲リストの難易度を曲DBエントリーのレベル欄へ書くとき、書く難易度と書き方を決める。

import type { CatalogLevels } from "../difficulty_names.ts";
import type { CatalogMatch } from "../../match.ts";

/** 素材の世代での曲の song_id と、5鍵盤版なら表の曲 */
interface SongIds {
  fiveKeyOf?: { generation?: string; ownLevels?: true; songId: number };
  sourceSongIndex: number;
}

export interface LevelsToWrite {
  levels: CatalogLevels;
  /** 5鍵盤版の裏は、表の行の難易度を、裏がある譜面にだけ写す */
  skipMissing: boolean;
}

/** 照合結果の行を、曲DBの曲番号から引ける表にする */
export function rowsBySongId(
  matches: readonly CatalogMatch[],
): Map<number, CatalogMatch["row"]> {
  return new Map(matches.map(({ row, song }) => [song.songId, row]));
}

/** 曲に書く難易度を選ぶ。行が無いか難易度の記載が無ければ、書かないのでundefinedを返す */
export function levelsToWrite(
  song: SongIds,
  rows: ReadonlyMap<number, { levels: CatalogLevels }>,
): LevelsToWrite | undefined {
  // 全曲リストで書いた組は、表の曲のレベルを写さず、5鍵盤版の行を見る
  const front = song.fiveKeyOf?.ownLevels ? undefined : song.fiveKeyOf?.songId;
  const levels = rows.get(front ?? song.sourceSongIndex)?.levels;
  if (levels == null || Object.keys(levels).length === 0) {
    return undefined;
  }
  return {
    levels,
    skipMissing: song.fiveKeyOf != null && !song.fiveKeyOf.ownLevels,
  };
}
