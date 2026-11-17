// 3rd〜8thの、曲DBの読み方の規則。

import type { SongmapRuleTable, TitleRule } from "./types.ts";

/**
 * 曲DBの題名の欄(ELFの別の場所を指す)を使う。全曲リストの管理名の照合と同じ欄で、曲の索引のキーを管理名と揃える。
 * 完全な題名の欄は、副題を含むことがあるので使わない
 */
const TITLE: TitleRule = { source: "pointer" };

const COMMON = {
  title: TITLE,
  chartArchive: null,
  soundPlan: "paired",
} as const;

/** 7thと8thの通し番号は、B・C・Aの順につなぐ。譜面はCのアーカイブにある */
const BCA = { ...COMMON, archiveOrder: [1, 2, 0], chartArchive: 2 } as const;

export const EARLY_RULES: Record<string, SongmapRuleTable> = {
  "3rd": {
    ...COMMON,
    songCount: 82,
    archiveOrder: [0],
    videoPlan: "derived",
  },
  "4th": {
    ...COMMON,
    songCount: 57,
    archiveOrder: [0],
    videoPlan: "derived",
  },
  // 定義の件数は142だが、プラグインは141曲だけを読む
  "5th": {
    ...COMMON,
    songCount: 141,
    archiveOrder: [0],
    videoPlan: "derived",
  },
  "6th": {
    ...COMMON,
    songCount: 215,
    archiveOrder: [0, 1],
    videoPlan: "secondaryThenPrimary",
  },
  "7th": { ...BCA, songCount: 90, videoPlan: "primary" },
  "8th": { ...BCA, songCount: 90, videoPlan: "mainThenPrimary" },
};
