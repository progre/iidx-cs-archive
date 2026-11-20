// 全曲リストの、組の中での扱いを書く3列(`save_slot_owner`・`chart_moves`・`front_rule`)を読む。

import type { CatalogRow } from "@csa/core";

export type CatalogFront = NonNullable<CatalogRow["front"]>;
export type CatalogRule = NonNullable<CatalogFront["rule"]>;
import { type Chart, isChart } from "./charts.ts";

/** 組のセーブの枠の持ち主にする行に書く`save_slot_owner`の値 */
const SLOT_OWNER = "*";

/** 5鍵盤版の組を書く`front_rule`の値 */
const FIVE_KEYS = "five_keys";

const PLAIN_RULES = ["alternate", "always", "random7", "random8"] as const;

/**
 * `sl=sa dl=da`の形。左が表の曲の難易度、右が裏の曲の難易度で、SP と DP はまたげない。
 * 1つの難易度に2つの譜面は出せないので、左に同じ難易度を2回書けない
 */
function chartMovesOf(
  text: string,
  line: number,
): Partial<Record<Chart, Chart>> {
  const pairs = text.trim().split(/\s+/).map((pair) => {
    const [front, back] = pair.split("=");
    if (!isChart(front) || !isChart(back) || front[0] !== back[0]) {
      throw new Error(`line ${line}: chart_movesの${pair}が読めない`);
    }
    return [front, back] as const;
  });
  const fronts = pairs.map(([front]) => front);
  const twice = fronts.find((front, index) => fronts.indexOf(front) !== index);
  if (twice !== undefined) {
    throw new Error(`line ${line}: chart_movesの左に${twice}を2回書いている`);
  }
  return Object.fromEntries(pairs);
}

/** `previousSong=<管理名>`の形か、`PLAIN_RULES`の名前 */
function ruleOf(text: string, line: number): CatalogRule {
  const [kind, after, ...extra] = text.split("=");
  if (kind === "previousSong" && after && extra.length === 0) {
    return { after, kind };
  }
  const plain = PLAIN_RULES.find((rule) => rule === text);
  if (plain === undefined) {
    throw new Error(`line ${line}: front_ruleの${text}が読めない`);
  }
  return { kind: plain };
}

/** 3列とも空なら`undefined` */
export function frontOf(
  [owner, charts, rule]: string[],
  line: number,
): CatalogFront | undefined {
  if ([owner, charts, rule].every((text) => text === "")) {
    return undefined;
  }
  // 5鍵盤版の行は、原作の5鍵盤版の裏になるときに、譜面を別の難易度へ出せる
  if (rule !== "" && rule !== FIVE_KEYS && charts !== "") {
    throw new Error(
      `line ${line}: front_ruleを書いた行には、chart_movesを書けない`,
    );
  }
  if (owner !== "" && owner !== SLOT_OWNER) {
    throw new Error(`line ${line}: save_slot_ownerには${SLOT_OWNER}を書く`);
  }
  if (rule !== "" && owner !== "") {
    throw new Error(
      `line ${line}: front_ruleを書いた行は、セーブの枠の持ち主にできない`,
    );
  }
  return {
    ...(charts === "" ? {} : { chartMoves: chartMovesOf(charts, line) }),
    ...(rule === FIVE_KEYS ? { fiveKeys: true as const } : {}),
    ...(owner === "" ? {} : { slotOwner: true as const }),
    ...(rule === "" || rule === FIVE_KEYS ? {} : { rule: ruleOf(rule, line) }),
  };
}
