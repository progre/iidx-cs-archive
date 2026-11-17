import type { TitleEncoding } from "@csa/core";

/** beginnerは、曲DBの専用の欄を指す */
export type LevelSource = number | "beginner";

export type TitleRule =
  | { source: "pointer" }
  | { source: "full"; encoding: TitleEncoding }
  | { source: "embedded"; encoding: TitleEncoding; indexPrefix: boolean };

export interface SongmapRule {
  /** 省略すると、曲DBの定義の件数を使う。定義の件数と違う世代だけ書く */
  songCount?: number;
  /** 通し番号をつなぐアーカイブの順。ファイル表の定義の添字で指す */
  archiveOrder: readonly number[];
  archiveNames?: "lowercase";
  videoPlan:
    | "derived"
    | "secondaryThenPrimary"
    | "primary"
    | "mainThenPrimary"
    | "firstWithTwin";
  levelIndexOf: Readonly<Record<string, LevelSource>>;
  title: TitleRule;
  /** nullなら、譜面のファイル番号が通し番号である */
  chartArchive: number | null;
  /** 譜面の欄とキー音・BGMの組の並び(`songs/chart_slots.ts`) */
  chartSlots: readonly string[];
  soundPlan: "paired" | "perChart";
}

/**
 * 世代ごとの規則の表に書く部分。
 * `chartSlots`と`levelIndexOf`は表に書かず、`songmapRuleOf`が`songs/`の表から足す
 */
export type SongmapRuleTable = Omit<SongmapRule, "chartSlots" | "levelIndexOf">;
