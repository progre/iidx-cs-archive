// 演奏中のBGM差し替えで、stubが現在曲indexから引く表。収録内容の裏エントリーから組む。
// 原作の組だけを持つ。全曲リストで足した組(規則`custom`)は`list_table.ts`の表が持つ。

import type { SwitchRule } from "@csa/core";
import type { SongContent } from "../../../model/mod.ts";
import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";

export const CODE_SLOT = STUB_SLOTS.bgmOverrideCode;
export const SEED_SLOT = STUB_SLOTS.bgmOverrideSeed;
export const TABLE_SLOT = STUB_SLOTS.bgmOverrideTable;
export const STUB_CODE = CODE_SLOT.vaddr;
export const STUB_SEED = SEED_SLOT.vaddr;
/** 上書き曲indexを書いたときの表の曲index。種の次の語に置く。書いていなければ`-1` */
export const OVERRIDE_FRONT = STUB_SEED + 4;
export const VARIANT_TABLE = TABLE_SLOT.vaddr;

/** 乱数の初期値。xorshiftは0から動かないので0以外を置く */
export const SEED_INITIAL = 0x1d872b41;

/** 行の語。`state`はstubが書き換える */
export const ROW_FIELDS = [
  "front",
  "rule",
  "primary",
  "secondary",
  "param",
  "trigger",
  "state",
] as const;
export const ROW_SIZE = ROW_FIELDS.length * 4;
export const fieldOffset = (name: typeof ROW_FIELDS[number]): number =>
  ROW_FIELDS.indexOf(name) * 4;

/** stubが分岐する規則。djtは同じ表の曲に2つの裏が付き、どちらも`triple`になる */
export const RULE = {
  always: 0,
  alternate: 1,
  random: 2,
  triple: 3,
} as const;

/** 原作の組の規則 */
type OriginalRule = Exclude<SwitchRule, "custom">;

const RULE_CODES: Record<OriginalRule, number> = {
  always: RULE.always,
  alternate: RULE.alternate,
  previousSong: RULE.triple,
  random7: RULE.triple,
  random8: RULE.random,
};

/** 乱数の法。`always`と`alternate`は乱数を使わない */
const RULE_PARAMS: Record<OriginalRule, number> = {
  always: 0,
  alternate: 0,
  previousSong: 7,
  random7: 7,
  random8: 8,
};

export interface VariantRow {
  front: number;
  param: number;
  primary: number;
  rule: number;
  secondary: number;
  trigger: number;
}

const emptyRow = (front: number): VariantRow => ({
  front,
  param: 0,
  primary: -1,
  rule: RULE.always,
  secondary: -1,
  trigger: -1,
});

const SECONDARY_RULES: readonly OriginalRule[] = ["random7"];

/**
 * 差し替え元の曲ごとに1行。`random7`が副の裏で、他は主の裏になる。
 * 同じ表の曲で条件が食い違うか、同じ側に裏が2つあれば止める
 */
export function variantRows(content: SongContent): VariantRow[] {
  const rows = new Map<number, VariantRow>();
  for (const song of content.songs) {
    const variant = song.variantOf;
    if (variant === undefined || variant.rule === "custom") continue;
    const rule = variant.rule;
    const front = variant.targetSongIndex;
    const known = rows.get(front);
    if (known !== undefined && known.rule !== RULE_CODES[rule]) {
      throw new Error(`曲index ${front}の裏エントリーの条件が食い違う`);
    }
    const row = known ?? emptyRow(front);
    row.rule = RULE_CODES[rule];
    row.param = RULE_PARAMS[rule];
    const side = SECONDARY_RULES.includes(rule) ? "secondary" : "primary";
    if (row[side] !== -1) {
      throw new Error(`曲index ${front}の同じ側に裏エントリーが2つある`);
    }
    row[side] = song.targetSongIndex;
    if (variant.afterTargetSongIndex !== undefined) {
      row.trigger = variant.afterTargetSongIndex;
    }
    rows.set(variant.targetSongIndex, row);
  }
  return [...rows.values()].sort((a, b) => a.front - b.front);
}

/** 表のバイト列。`front`が`-1`の終端行で終わる */
export function variantTableBytes(content: SongContent): Uint8Array {
  const rows = variantRows(content);
  const bytes = new Uint8Array((rows.length + 1) * ROW_SIZE);
  const view = new DataView(bytes.buffer);
  rows.forEach((row, index) => {
    const at = index * ROW_SIZE;
    view.setInt32(at + fieldOffset("front"), row.front, true);
    view.setInt32(at + fieldOffset("rule"), row.rule, true);
    view.setInt32(at + fieldOffset("primary"), row.primary, true);
    view.setInt32(at + fieldOffset("secondary"), row.secondary, true);
    view.setInt32(at + fieldOffset("param"), row.param, true);
    view.setInt32(at + fieldOffset("trigger"), row.trigger, true);
  });
  view.setInt32(rows.length * ROW_SIZE + fieldOffset("front"), -1, true);
  return bytes;
}
