/** 許可一覧の直接参照siteを、新しい配置の参照先に向ける。 */

import type { InstructionPatchBook } from "../../../elf/mod.ts";
import { hiOf, isZeroExt } from "../../mips/mod.ts";
import { type DirectGroup, HIGH_ALIASES } from "../allowlist/mod.ts";
import { targetReference, type WorkLayout } from "../layout.ts";
import {
  addHigh,
  addLow,
  type HighGroup,
  type HighUse,
  type MetadataFactory,
  registerHigh,
  type WordAt,
} from "./patch_high.ts";

export type { MetadataFactory, WordAt };
export type DirectPatchSummary = Readonly<{
  directSiteCount: number;
  farCount: number;
  highGroupCount: number;
  splitCount: number;
}>;

const DIRECT_SITE_COUNT = 845;
const HIGH_GROUP_COUNT = 421;
const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** `lui`を持たない即値site。16bitに収まらなければstubで上位を作る(`far_lo`)。 */
function addSingle(
  book: InstructionPatchBook,
  use: HighUse,
  makeMetadata: MetadataFactory,
): number {
  const zeroExt = isZeroExt(use.word);
  const limit = zeroExt ? 0xffff : 0x7fff;
  assert(use.target >= 0, `${hex(use.lowAddress)}の参照先が負です`);
  const fits = use.target <= limit;
  assert(fits || !zeroExt, `${hex(use.lowAddress)}へ16bit値を格納できません`);
  addLow(book, use, fits ? "single16" : "far_lo", makeMetadata);
  return fits ? 0 : 1;
}

function addGroup(
  book: InstructionPatchBook,
  layout: WorkLayout,
  highs: Map<number, HighGroup>,
  group: DirectGroup,
  makeMetadata: MetadataFactory,
  wordAt: WordAt,
): [sites: number, far: number] {
  let count = 0, far = 0;
  for (const [address, oldReference, highAddress] of group.sites) {
    const target = targetReference(layout, group.kind, oldReference);
    const word = wordAt(address);
    const use: HighUse = {
      functionName: group.functionName,
      kind: group.kind,
      lowAddress: address,
      oldReference,
      target,
      targetHigh: hiOf(target, isZeroExt(word)),
      word,
    };
    count++;
    if (highAddress === 0) {
      far += addSingle(book, use, makeMetadata);
      continue;
    }
    registerHigh(highs, highAddress, use, wordAt);
    for (const [, lowAddress, aliasAddress] of HIGH_ALIASES) {
      if (lowAddress !== address) continue;
      registerHigh(highs, aliasAddress, use, wordAt);
    }
  }
  return [count, far];
}

export function addDirectPatches(
  book: InstructionPatchBook,
  layout: WorkLayout,
  directGroups: readonly DirectGroup[],
  makeMetadata: MetadataFactory,
  wordAt: WordAt,
): DirectPatchSummary {
  const highs = new Map<number, HighGroup>();
  let directSiteCount = 0, singleFarCount = 0;
  for (const group of directGroups) {
    const [sites, far] = addGroup(
      book,
      layout,
      highs,
      group,
      makeMetadata,
      wordAt,
    );
    directSiteCount += sites;
    singleFarCount += far;
  }
  const high = addHigh(book, highs, makeMetadata, wordAt);
  assert(
    directSiteCount === DIRECT_SITE_COUNT,
    "direct siteが登録数と一致しません",
  );
  assert(
    highs.size === HIGH_GROUP_COUNT + HIGH_ALIASES.length,
    "high groupが登録数と一致しません",
  );
  return {
    directSiteCount,
    farCount: high.farCount + singleFarCount,
    highGroupCount: highs.size,
    splitCount: high.splitCount,
  };
}
