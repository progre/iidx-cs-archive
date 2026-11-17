// 曲DBから、曲が参照するファイルの一覧をメモリー上に作る規則。
// USは9thと同じ形で組む。
// 規則は、3rd〜8thを`songmap/early.ts`、9th以降とUSを`songmap/late.ts`が持つ。

import { chartSlotsOf } from "../songs/mod.ts";
import { EARLY_RULES } from "./early.ts";
import { levelSourcesOf } from "./level_sources.ts";
import type { SongmapRule, SongmapRuleTable } from "./types.ts";

// 9th以降とUSの、曲DBの読み方の規則。PBは16th(emp)と同じ読み方である。
/** 曲の数は定義の件数、譜面の番号は通し番号である。題名は曲DBの枠に埋め込まれている */
const COMMON = {
  chartArchive: null,
  soundPlan: "paired",
  title: { source: "embedded", encoding: "shift-jis", indexPrefix: false },
  videoPlan: "firstWithTwin",
} as const;

/** アーカイブがA・B・Cの3本に分かれる世代。プラグインが小文字の名前を渡すので、一覧にも小文字で書く */
const ABC = {
  ...COMMON,
  archiveNames: "lowercase",
  archiveOrder: [0, 1, 2],
} as const;

const SINGLE = { ...COMMON, archiveOrder: [0] } as const;

export const LATE_RULES: Record<string, SongmapRuleTable> = {
  "9th": SINGLE,
  "10th": SINGLE,
  "us": {
    ...SINGLE,
    soundPlan: "perChart",
    title: { source: "embedded", encoding: "shift-jis", indexPrefix: true },
  },
  "red": SINGLE,
  "hs": ABC,
  "dd": ABC,
  "gold": ABC,
  "djt": ABC,
  "emp": ABC,
  "pb": ABC,
};

export type { LevelSource, SongmapRule, TitleRule } from "./types.ts";

const RULES: Record<string, SongmapRuleTable> = {
  ...EARLY_RULES,
  ...LATE_RULES,
};

/** 規則が件数を決めていればその値、無ければ曲DBの定義の件数 */
export function songCountOf(
  rule: Pick<SongmapRule, "songCount">,
  definedCount: number,
): number {
  return rule.songCount ?? definedCount;
}

/** 世代の規則。曲DBの世代なら必ずある */
export function songmapRuleOf(generation: string): SongmapRule {
  const rule = RULES[generation];
  if (rule === undefined) {
    throw new Error(`規則が無い世代: ${generation}`);
  }
  return {
    ...rule,
    chartSlots: chartSlotsOf(generation),
    levelIndexOf: levelSourcesOf(generation),
  };
}
