/**
 * site 1命令を`j stub`に差し替えるときの形を選ぶ。
 *
 * `j`は遅延スロットを持つので、差し替えた命令の次の命令が先に実行される。
 * そのため2命令ぶんを預かり、stub側で元の順序を再現する。
 *
 * - next: siteと次の命令を預かる。次が分岐でも分岐先でもないときに使う。
 * - prev: 前の命令とsiteを預かる。siteが分岐先でないときに使う。
 * - slot: siteが遅延スロットにある。分岐ごと預かり、stub内で分岐を再現する。
 */

import {
  branchTarget,
  decodeFields,
  isBranch,
  isControl,
  isJump,
  isLikely,
  j,
  jr,
  NOP,
  rebranch,
} from "../../mips/mod.ts";

export type Form = "next" | "prev" | "slot";

export type Site = Readonly<{
  address: number;
  /** 差し替え前の命令語。 */
  word: number;
  widened: readonly number[];
}>;

export type Context = Readonly<{
  /** address -> 前段を当てた後の命令語。 */
  wordAt(address: number): number;
  /** 分岐・ジャンプ・jump tableの飛び先。 */
  isTarget(address: number): boolean;
  /** 既に別のstubへ預けたaddress。 */
  isConsumed(address: number): boolean;
}>;

export type Placement = Readonly<{
  form: Form;
  /** 差し替える2命令。順にaddressと新しい命令語。 */
  patches: readonly (readonly [number, number])[];
  /** stubの命令語。`stubBase`を先頭addressとして符号化済み。 */
  words: readonly number[];
  consumed: readonly number[];
}>;

const tail = (returnTo: number) => [j(returnTo), NOP];

function chooseForm(site: Site, context: Context): Form {
  const a = site.address;
  const previous = context.wordAt(a - 4), next = context.wordAt(a + 4);
  if (isControl(previous)) {
    if (context.isConsumed(a - 4) || isControl(context.wordAt(a - 8))) {
      throw new Error(
        "遅延スロットのsiteだが分岐を預かれない: 0x" + a.toString(16),
      );
    }
    return "slot";
  }
  if (
    !isControl(next) && !context.isTarget(a + 4) && !context.isConsumed(a + 4)
  ) {
    return "next";
  }
  if (
    !context.isTarget(a) && !context.isConsumed(a - 4) &&
    !isControl(context.wordAt(a - 8))
  ) {
    return "prev";
  }
  throw new Error("差し替えの形を選べない: 0x" + a.toString(16));
}

/** 預かった命令をstubへ写す。PC相対の命令は写せない。 */
function relocated(word: number, address: number): number {
  if (isControl(word)) {
    throw new Error("分岐を預かることはできない: 0x" + address.toString(16));
  }
  return word;
}

function slotPlacement(
  site: Site,
  context: Context,
  stubBase: number,
): Placement {
  const a = site.address;
  const control = context.wordAt(a - 4);
  const patches = [[a - 4, j(stubBase)], [a, NOP]] as const;
  const consumed = [a - 4, a];
  if (isBranch(control)) {
    const target = branchTarget(control, a - 4)!;
    // 分岐を先に判定し、成立側と不成立側の両方でsiteを実行する。
    // likelyは成立側だけで実行する。
    const fallthrough = [
      ...(isLikely(control) ? [] : site.widened),
      ...tail(a + 4),
    ];
    const takenOffset = 2 + fallthrough.length;
    const words = [
      rebranch(control, stubBase, stubBase + takenOffset * 4),
      NOP,
      ...fallthrough,
      ...site.widened,
      ...tail(target),
    ];
    return { consumed, form: "slot", patches, words };
  }
  if (isJump(control)) {
    const { op, fn, rs } = decodeFields(control);
    if (op === 0x02) {
      return {
        consumed,
        form: "slot",
        patches,
        words: [...site.widened, ...tail(branchTarget(control, a - 4)!)],
      };
    }
    if (op === 0x03) {
      // jalの戻り先はstub内になる。戻ってから元の続きへ飛ぶ。
      return {
        consumed,
        form: "slot",
        patches,
        words: [
          ...site.widened,
          j(branchTarget(control, a - 4)!, true),
          NOP,
          ...tail(a + 4),
        ],
      };
    }
    if (fn === 0x08) {
      if (decodeFields(site.word).rt === rs) {
        throw new Error("jrの基底をsiteが書き換える: 0x" + a.toString(16));
      }
      return {
        consumed,
        form: "slot",
        patches,
        words: [...site.widened, jr(rs), NOP],
      };
    }
    if (fn === 0x09) {
      return {
        consumed,
        form: "slot",
        patches,
        words: [...site.widened, control, NOP, ...tail(a + 4)],
      };
    }
  }
  throw new Error(
    "預かれない制御命令: 0x" + (a - 4).toString(16) + " rd=" +
      decodeFields(control).rd,
  );
}

export function place(
  site: Site,
  context: Context,
  stubBase: number,
  chained?: Site,
): Placement {
  const a = site.address;
  const form = chooseForm(site, context);
  if (form === "slot") return slotPlacement(site, context, stubBase);
  if (form === "next") {
    const following = chained === undefined
      ? [relocated(context.wordAt(a + 4), a + 4)]
      : chained.widened;
    return {
      consumed: [a, a + 4],
      form,
      patches: [[a, j(stubBase)], [a + 4, NOP]],
      words: [...site.widened, ...following, ...tail(a + 8)],
    };
  }
  return {
    consumed: [a - 4, a],
    form,
    patches: [[a - 4, j(stubBase)], [a, NOP]],
    words: [
      relocated(context.wordAt(a - 4), a - 4),
      ...site.widened,
      ...tail(a + 4),
    ],
  };
}
