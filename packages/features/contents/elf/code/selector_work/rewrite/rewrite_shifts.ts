/**
 * record長`R`と`4N`のstrideを、原盤の5命令枠に収まるshift列で合成する。
 *
 * recordStrideShiftの39組のうち35組は5命令の宛先registerが同一で、中間値を保持できない。
 * 合成は直前の結果とsourceだけを使う連鎖に限られ、Rの候補もその形に収まる値だけになる。
 */

import { addu, rdOf, rtOf, sll, subu } from "../../mips/mod.ts";
import type { RewriteGroup } from "../allowlist/mod.ts";
import { minimumRecordSize } from "../layout.ts";
import type { WordAt } from "../patch/mod.ts";

const PB_RECORD_SIZE = 0x3e8;
/** 中間値を移すだけの段。`addu rd, rs, zero`で書く。 */
const move = (target: number, source: number) => addu(target, source, 0);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type ShiftStep =
  | readonly ["sll", number]
  | readonly ["addSource"]
  | readonly ["subSource"]
  | readonly ["move"];

// 実機成立済みのE=498はこの列を使う。探索で別解に振り替えないよう固定する。
const CONFIRMED_PLANS = new Map<number, readonly ShiftStep[]>([
  [0x3f0, [["sll", 6], ["subSource"], ["sll", 2], ["move"], ["sll", 2]]],
]);

// 右shiftが無いため中間値はtarget+1を超えない。探索はその範囲だけを見る。
function searchPlan(
  target: number,
  limit: number,
): readonly ShiftStep[] | undefined {
  const walk = (
    value: number,
    steps: readonly ShiftStep[],
  ): readonly ShiftStep[] | undefined => {
    if (value === target) {
      const padding = Array.from(
        { length: 5 - steps.length },
        () => ["move"] as const,
      );
      return [...steps, ...padding];
    }
    if (steps.length >= limit) return undefined;
    for (let shift = 1; value << shift <= target + 1; shift++) {
      const found = walk(value << shift, [...steps, ["sll", shift]]);
      if (found !== undefined) return found;
    }
    const up = value + 1 <= target + 1
      ? walk(value + 1, [...steps, ["addSource"]])
      : undefined;
    if (up !== undefined) return up;
    return value > 1 ? walk(value - 1, [...steps, ["subSource"]]) : undefined;
  };
  return walk(1, []);
}

export function findRecordShiftPlan(
  recordSize: number,
): readonly ShiftStep[] | undefined {
  const confirmed = CONFIRMED_PLANS.get(recordSize);
  if (confirmed !== undefined) return confirmed;
  for (let limit = 1; limit <= 5; limit++) {
    const plan = searchPlan(recordSize, limit);
    if (plan !== undefined) return plan;
  }
  return undefined;
}

// 合成できるrecord長を小さい順に返す。共有luiが割れる構成は呼び出し側で捨てる。
// wideは曲indexの上位byte配列を含む9+3Eから探す。
export function recordSizeCandidates(
  entries: number,
  count: number,
  wide = false,
): readonly number[] {
  const start = Math.max(minimumRecordSize(entries, wide), PB_RECORD_SIZE);
  const found: number[] = [];
  for (let size = start; size <= start + 0x2000; size += 4) {
    if (found.length >= count) break;
    if (size === PB_RECORD_SIZE || findRecordShiftPlan(size) !== undefined) {
      found.push(size);
    }
  }
  assert(found.length > 0, "E=" + entries + "のrecord長を合成できません");
  return found;
}

function stepWord(
  step: ShiftStep,
  destination: number,
  previous: number,
  source: number,
): number {
  if (step[0] === "sll") return sll(destination, previous, step[1]);
  if (step[0] === "addSource") return addu(destination, previous, source);
  if (step[0] === "subSource") return subu(destination, previous, source);
  return move(destination, previous);
}

function stepValue(step: ShiftStep, previous: number): number {
  if (step[0] === "sll") return previous << step[1];
  if (step[0] === "addSource") return previous + 1;
  if (step[0] === "subSource") return previous - 1;
  return previous;
}

export function buildRecordShift(
  group: RewriteGroup,
  recordSize: number,
  targets: Map<number, number>,
  wordAt: WordAt,
): void {
  const destinations = group.sites.map((address) => rdOf(wordAt(address)));
  const source = rtOf(wordAt(group.sites[0]));
  const plan = findRecordShiftPlan(recordSize);
  assert(plan !== undefined, "R shiftの合成手順がありません");
  const lastSourceUse = plan.reduce(
    (last, step, index) =>
      step[0] === "addSource" || step[0] === "subSource" ? index : last,
    0,
  );
  let value = 1;
  for (const [index, step] of plan.entries()) {
    assert(
      index >= lastSourceUse || destinations[index] !== source,
      "R shiftがsourceを使い切る前に破壊します",
    );
    const previous = index === 0 ? source : destinations[index - 1];
    targets.set(
      group.sites[index],
      stepWord(step, destinations[index], previous, source),
    );
    value = stepValue(step, value);
  }
  assert(value === recordSize, "R shiftの合成結果がrecord長と一致しません");
}

export function buildFourSongsShift(
  group: RewriteGroup,
  targets: Map<number, number>,
  wordAt: WordAt,
): void {
  const destinations = group.sites.map((address) => rdOf(wordAt(address)));
  const source = rtOf(wordAt(group.sites[0]));
  const set = (index: number, word: number) =>
    targets.set(group.sites[index], word);
  if (group.strategy === "shiftSourceEarly") {
    set(0, sll(destinations[0], source, 5));
    set(1, sll(destinations[1], destinations[0], 2));
    set(2, addu(destinations[2], destinations[1], destinations[0]));
    set(3, subu(destinations[3], destinations[2], source));
    set(4, sll(destinations[4], destinations[3], 2));
    return;
  }
  assert(
    destinations.slice(0, 4).every((destination) => destination !== source),
    "4N shiftが最終加算前にsourceを破壊します",
  );
  set(0, sll(destinations[0], source, 7));
  set(1, subu(destinations[1], destinations[0], source));
  set(2, sll(destinations[2], destinations[1], 2));
  set(3, addu(destinations[3], destinations[2], destinations[1]));
  set(4, addu(destinations[4], destinations[3], source));
}
