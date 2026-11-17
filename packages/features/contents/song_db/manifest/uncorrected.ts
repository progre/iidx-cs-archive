// 曲DBエントリを補正した後に、補正で変わった値の補正前の値を残す。
// 曲リストが`補正前→補正後`の形で出すために使う。

import type { ManifestUncorrected } from "@csa/core";
import type { PbEntryFormat } from "../pb/format/mod.ts";

const levelsOf = (format: PbEntryFormat, entry: Uint8Array) =>
  format.levelsOf(format.recordOf(entry));

/** 補正の前後で違うレベルの、補正前の値 */
function changedLevels(
  format: PbEntryFormat,
  before: Uint8Array,
  after: Uint8Array,
): Record<string, number> | undefined {
  const afterLevels = levelsOf(format, after);
  const changed = Object.entries(levelsOf(format, before)).filter((
    [name, level],
  ) => afterLevels[name] !== level);
  return changed.length === 0 ? undefined : Object.fromEntries(changed);
}

/**
 * `ruleVersion`は、全曲リストの`folder`列が無ければ規則が決める作品番号である。
 * 指定の無い曲は`undefined`、規則で決まらない曲は`null`になる
 */
export function uncorrectedOf(
  format: PbEntryFormat,
  before: Uint8Array,
  after: Uint8Array,
  ruleVersion: number | null | undefined,
  version: number,
): ManifestUncorrected | undefined {
  const levels = changedLevels(format, before, after);
  const versionChanged = ruleVersion !== undefined && ruleVersion !== version;
  if (levels === undefined && !versionChanged) {
    return undefined;
  }
  return {
    ...(levels === undefined ? {} : { levels }),
    ...(versionChanged ? { version: ruleVersion } : {}),
  };
}
