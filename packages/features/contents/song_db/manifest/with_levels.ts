// 全曲リストの難易度を、manifestの曲DBエントリーへ書く。
// 書く難易度の選択は呼び出し側が`ports`で渡す。全曲リストの行は、周回で読んだものを受け取る。

import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { limitBeginnerLevel, writeDifficultyLevels } from "../pb/mod.ts";
import type { PbEntryFormat } from "../pb/format/mod.ts";

type Row = Pick<
  ManifestSongDraft,
  "catalogLevels" | "fiveKeyOf" | "sourceGeneration" | "sourceSongIndex"
>;

type Levels = CatalogRow["levels"];

export interface LevelPorts {
  /** 全曲リストの譜面の列 → 曲DBの難易度名とレベル */
  levelsByDifficulty: (levels: Levels) => [name: string, level: number][];
  /** 曲の行から書く難易度を選ぶ。書かない曲は`undefined` */
  levelsToWrite: (
    row: Row,
    rows: ReadonlyMap<number, { levels: Levels }>,
  ) => { levels: Levels; skipMissing: boolean } | undefined;
}

/**
 * 全曲リストの行から、エントリーのレベル欄を書き換える。
 * 曲の行の難易度(`catalogLevels`)があれば、曲番号ごとの1行目でなく、その行の値を使う。
 * 同じ曲を2行に書いた曲では、2行目の行の難易度が1行目と違うことがあるからである
 */
export function withLevels(
  ports: LevelPorts,
  format: PbEntryFormat,
  entryText: string,
  row: Row,
  rows: Map<number, Pick<CatalogRow, "levels">>,
): string {
  const own = row.catalogLevels;
  const target = ports.levelsToWrite(
    row,
    own === undefined
      ? rows
      : new Map([...rows, [row.sourceSongIndex, { levels: own }]]),
  );
  if (target === undefined) {
    return entryText;
  }
  const entry = format.decode(entryText);
  try {
    writeDifficultyLevels(
      format.recordOf(entry),
      ports.levelsByDifficulty(target.levels),
      target.skipMissing,
    );
  } catch (cause) {
    throw new Error(`${row.sourceGeneration} song${row.sourceSongIndex}`, {
      cause,
    });
  }
  return format.encode(entry);
}

/** SP BEGINNER のレベルは、原作の値も全曲リストの値も上限以内に抑える */
export function withBeginnerLimit(
  format: PbEntryFormat,
  entryText: string,
): string {
  const entry = format.decode(entryText);
  limitBeginnerLevel(format.recordOf(entry));
  return format.encode(entry);
}
