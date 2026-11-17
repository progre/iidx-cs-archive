/**
 * 直接参照の`lui`(上位16bit)と、それに結び付く低位命令を確定する。
 * 1つの`lui`を複数の低位命令が共有すると、全ての低位命令が同じ上位16bitに届かなくなる。
 * 分離に使える空き命令があれば、そこへ2つ目の`lui`を置く(`HIGH_SPLITS`)。
 * 空き命令が無ければ`lui`を多数派に揃える。揃わなかった低位命令はstubへ回す(`far_lo`)。
 * 低位命令の行は`lui`が決まってから書く。
 */

import type { InstructionPatchBook, PatchMetadata } from "../../../elf/mod.ts";
import { isZeroExt, rdOf } from "../../mips/mod.ts";
import { type DirectKind, HIGH_SPLITS } from "../allowlist/mod.ts";

export type WordAt = (address: number) => number;

export type MetadataFactory = (
  functionName: string,
  address: number,
  form: string,
  oldReference: string,
  newReference: string,
  usage: string,
  rationale?: string,
) => PatchMetadata;

export type HighUse = Readonly<{
  functionName: string;
  kind: DirectKind;
  lowAddress: number;
  oldReference: number;
  target: number;
  targetHigh: number;
  /** 書き換え前の命令語。ELFから読む。 */
  word: number;
}>;
export type HighGroup = { uses: HighUse[]; word: number };
export type HighSummary = Readonly<{ farCount: number; splitCount: number }>;

const FAR_RATIONALE = "共有luiが割れるためstubで上位16bitを作る";
const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function registerHigh(
  highs: Map<number, HighGroup>,
  highAddress: number,
  use: HighUse,
  wordAt: WordAt,
): void {
  const high = highs.get(highAddress) ??
    { uses: [], word: wordAt(highAddress) };
  high.uses.push(use);
  highs.set(highAddress, high);
}

/** 空き命令へ2つ目の`lui`を置き、分離した低位命令の上位16bitを返す。 */
function splitHigh(
  book: InstructionPatchBook,
  group: HighGroup,
  split: (typeof HIGH_SPLITS)[number],
  makeMetadata: MetadataFactory,
  wordAt: WordAt,
): number {
  const [functionName, , splitAddress, detachedLow] = split;
  const detached = group.uses.find((use) => use.lowAddress === detachedLow);
  assert(detached !== undefined, "共有luiの分離対象がありません");
  const oldWord = wordAt(splitAddress);
  const splitWord = 0x3c000000 | (rdOf(oldWord) << 16) | detached.targetHigh;
  book.add(
    splitAddress,
    splitWord,
    makeMetadata(
      functionName,
      splitAddress,
      "split_lui",
      hex(oldWord),
      hex(splitWord),
      detached.kind,
      "共有luiの上位16bitを分離",
    ),
  );
  return detached.targetHigh;
}

/** 最も多い上位16bit。同数なら小さい値に揃える(どちらを残しても他方はstubへ回る)。 */
function majorityHigh(uses: readonly HighUse[]): number {
  const counts = new Map<number, number>();
  for (const use of uses) {
    counts.set(use.targetHigh, (counts.get(use.targetHigh) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return ranked[0][0];
}

export function addLow(
  book: InstructionPatchBook,
  use: HighUse,
  form: "far_lo" | "lui_lo" | "single16",
  makeMetadata: MetadataFactory,
  luiAddress?: number,
): void {
  assert(
    form !== "far_lo" || !isZeroExt(use.word),
    `${hex(use.lowAddress)}の零拡張命令はfar_loにできません`,
  );
  // far_loのstubは`lui`の残り値との差を作るので、rationaleに`lui`の位置を添える。
  // usageはE依存の分類に使うため変えない。
  const rationale = form !== "far_lo"
    ? undefined
    : luiAddress === undefined
    ? FAR_RATIONALE
    : `${FAR_RATIONALE}(lui=${hex(luiAddress)})`;
  book.add(
    use.lowAddress,
    ((use.word & 0xffff0000) | (use.target & 0xffff)) >>> 0,
    makeMetadata(
      use.functionName,
      use.lowAddress,
      form,
      hex(use.oldReference),
      hex(use.target),
      use.kind,
      rationale,
    ),
  );
}

export function addHigh(
  book: InstructionPatchBook,
  highs: ReadonlyMap<number, HighGroup>,
  makeMetadata: MetadataFactory,
  wordAt: WordAt,
): HighSummary {
  let farCount = 0, splitCount = 0;
  const decided = new Map<number, [form: "far_lo" | "lui_lo", lui: number]>();
  for (const [address, group] of highs) {
    assert(group.word >>> 26 === 0x0f, `${hex(address)}はluiではありません`);
    const split = HIGH_SPLITS.find(([, highAddress]) =>
      highAddress === address
    );
    const distinct = new Set(group.uses.map((use) => use.targetHigh));
    const retained = group.uses.filter((use) =>
      split === undefined || use.lowAddress !== split[3]
    );
    const sharedHigh = majorityHigh(retained);
    if (split !== undefined && distinct.size > 1) {
      assert(
        splitHigh(book, group, split, makeMetadata, wordAt) !== sharedHigh,
        "共有luiの分離が不要です: " + hex(address),
      );
      splitCount++;
    }
    for (const use of group.uses) {
      const isDetached = split !== undefined && use.lowAddress === split[3];
      const form = isDetached || use.targetHigh === sharedHigh
        ? "lui_lo"
        : "far_lo";
      const previous = decided.get(use.lowAddress);
      assert(
        previous === undefined || previous[0] === form,
        `${hex(use.lowAddress)}へ届くluiで判断が割れます`,
      );
      if (previous === undefined) {
        decided.set(use.lowAddress, [form, address]);
        addLow(book, use, form, makeMetadata, address);
        if (form === "far_lo") farCount++;
      }
    }
    book.add(
      address,
      ((group.word & 0xffff0000) | sharedHigh) >>> 0,
      makeMetadata(
        group.uses[0].functionName,
        address,
        "lui_hi",
        hex(group.word & 0xffff),
        hex(sharedHigh),
        group.uses.map((use) => use.kind).join("+"),
      ),
    );
  }
  return { farCount, splitCount };
}
