/** 5命令のstride合成列を、新しい配置のstrideに組み替える。 */

import { addiu, addu, mult, rdOf, reg, rtOf } from "../../mips/mod.ts";
import {
  MULTIPLY_COUPLINGS,
  REWRITE_GROUPS,
  type RewriteGroup,
} from "../allowlist/mod.ts";
import type { WorkLayout } from "../layout.ts";
import type { WordAt } from "../patch/mod.ts";
import { buildFourSongsMultiply } from "./four_songs.ts";
import { buildFourSongsShift, buildRecordShift } from "./rewrite_shifts.ts";

const PB_RECORD_SIZE = 0x3e8;
const REWRITE_TARGET_COUNT = 270;
const MULTIPLY_TARGET_COUNT = 55;
/** 中間値を移すだけの段。`addu rd, rs, zero`で書く。 */
const move = (target: number, source: number) => addu(target, source, 0);
const constant = (target: number, value: number) =>
  addiu(target, reg.zero, value);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rewriteOperands(group: RewriteGroup, wordAt: WordAt) {
  const firstWord = wordAt(group.sites[0]);
  const lastWord = wordAt(group.sites[4]);
  assert((firstWord & 0x3f) === 0, "rewrite先頭命令がsllではありません");
  assert((lastWord & 0x3f) === 0, "rewrite末尾命令がsllではありません");
  return {
    output: rdOf(lastWord),
    source: rtOf(firstWord),
    temporary: rdOf(firstWord),
  };
}

function clear(group: RewriteGroup, targets: Map<number, number>): void {
  for (const address of group.sites) targets.set(address, 0);
}

function buildEarly(
  group: RewriteGroup,
  value: number,
  targets: Map<number, number>,
  wordAt: WordAt,
): void {
  const { output, source, temporary } = rewriteOperands(group, wordAt);
  clear(group, targets);
  targets.set(group.sites[0], constant(temporary, value));
  targets.set(group.sites[1], mult(output, source, temporary));
}

function buildDeferred(
  group: RewriteGroup,
  value: number,
  targets: Map<number, number>,
  wordAt: WordAt,
): void {
  const { output, source, temporary } = rewriteOperands(group, wordAt);
  clear(group, targets);
  targets.set(group.sites[0], constant(temporary, value));
  targets.set(group.sites[1], mult(source, source, temporary));
  targets.set(group.sites[4], move(output, source));
}

function buildCoupled(
  first: RewriteGroup,
  second: RewriteGroup,
  songs: number,
  targets: Map<number, number>,
  wordAt: WordAt,
): void {
  const a = rewriteOperands(first, wordAt), b = rewriteOperands(second, wordAt);
  const holding = rdOf(wordAt(first.sites[1]));
  assert(a.temporary === b.temporary, "交差pairの定数registerが一致しません");
  assert(a.output === b.source, "交差pairの出力と入力が一致しません");
  assert(b.output === a.temporary, "交差pairの定数と出力が一致しません");
  clear(first, targets);
  clear(second, targets);
  targets.set(first.sites[0], constant(a.temporary, 4 * songs));
  targets.set(first.sites[1], mult(holding, a.source, a.temporary));
  targets.set(second.sites[0], mult(b.output, b.source, b.temporary));
  targets.set(first.sites[2], move(a.output, holding));
}

function buildMultiplyTargets(
  songs: number,
  wordAt: WordAt,
): ReadonlyMap<number, number> {
  const groups = REWRITE_GROUPS.filter((group) =>
    group.kind.endsWith("Multiply")
  );
  const byAddress = new Map(groups.map((group) => [group.sites[0], group]));
  const targets = new Map<number, number>();
  for (const group of groups) {
    if (group.strategy === "multiplyEarly") {
      buildEarly(
        group,
        group.kind === "fourSongsStrideMultiply" ? 4 * songs : 20 * songs,
        targets,
        wordAt,
      );
    } else if (group.strategy === "multiplyDeferred") {
      buildDeferred(group, 4 * songs, targets, wordAt);
    }
  }
  for (const [firstStart, secondStart] of MULTIPLY_COUPLINGS) {
    const first = byAddress.get(firstStart),
      second = byAddress.get(secondStart);
    assert(
      first?.strategy === "multiplyCoupledFirst",
      "交差pair先頭が一致しません",
    );
    assert(
      second?.strategy === "multiplyCoupledSecond",
      "交差pair末尾が一致しません",
    );
    buildCoupled(first, second, songs, targets, wordAt);
  }
  assert(
    targets.size === MULTIPLY_TARGET_COUNT,
    "乗算targetが登録数と一致しません",
  );
  return targets;
}

export function buildRewriteTargets(
  layout: WorkLayout,
  wordAt: WordAt,
): ReadonlyMap<number, number> {
  const targets = new Map(
    REWRITE_GROUPS.flatMap((group) =>
      group.sites.map((address) => [address, wordAt(address)] as const)
    ),
  );
  if (layout.songs === 99 && layout.entries === 495) return targets;
  for (const group of REWRITE_GROUPS) {
    if (group.kind === "recordStrideShift") {
      if (layout.recordSize === PB_RECORD_SIZE) continue;
      buildRecordShift(group, layout.recordSize, targets, wordAt);
    } else if (group.kind === "fourSongsStrideShift") {
      // 実機成立済みの159曲は手書きの列を保ち、他のNは即値とmultに置き換える。
      if (layout.songs === 159) buildFourSongsShift(group, targets, wordAt);
      else buildFourSongsMultiply(wordAt, group, layout.songs, targets);
    }
  }
  for (const [address, word] of buildMultiplyTargets(layout.songs, wordAt)) {
    targets.set(address, word);
  }
  assert(
    targets.size === REWRITE_TARGET_COUNT,
    "全rewrite targetが登録数と一致しません",
  );
  return targets;
}
