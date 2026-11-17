/**
 * 4N strideの5命令列を「即値 + mult」に置き換える。
 * 定数は先頭siteの宛先registerへ置く。
 * 符号拡張を置くsiteは、出力registerの旧値を読む命令が済んだ後から選ぶ。
 * そのsiteには`sll 0`を置く。この命令の結果が、符号拡張済みのsourceとして出力registerに入る。
 * 次のsiteで積を書く。残るsiteはnopにする。
 * multのoperandは符号拡張済みの32bitでなければならない。sourceが関数の引数のときは、
 * 関数の中に符号拡張の根拠がない。そのため符号拡張を組の中で作る。
 * 5命令の間には別の命令が挟まる。挟まった命令が組の中間値を読むなら置き換えを止める。
 */

import {
  addiu,
  decodeRegisterFlow,
  mult,
  rdOf,
  reg,
  type RegisterFlow,
  rtOf,
  sll,
} from "../../mips/mod.ts";
import type { RewriteGroup } from "../allowlist/mod.ts";
import type { WordAt } from "../patch/mod.ts";

const STEPS = 5;
/** addiuの即値は符号付き16bitなので、4Nはこの値まで */
const MAX_IMMEDIATE = 0x7fff;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

/** site iとi+1の間に挟まる命令の流れ。分岐や、それまでの中間値を読む命令があれば止める */
function gapFlows(
  wordAt: WordAt,
  group: RewriteGroup,
  destinations: readonly number[],
): readonly (readonly RegisterFlow[])[] {
  return group.sites.slice(0, -1).map((address, index) => {
    const written = new Set(destinations.slice(0, index + 1));
    const flows: RegisterFlow[] = [];
    for (let at = address + 4; at < group.sites[index + 1]; at += 4) {
      const flow = decodeRegisterFlow(wordAt(at));
      assert(flow.known && !flow.control, `${hex(at)}は分類できない命令です`);
      assert(
        flow.reads.every((register) => !written.has(register)),
        `${hex(at)}が4N shiftの中間値を読むため置き換えられません`,
      );
      flows.push(flow);
    }
    return flows;
  });
}

const touches = (flow: RegisterFlow, register: number) =>
  flow.reads.includes(register) || flow.writes.includes(register);

/**
 * 符号拡張を置くsiteを選ぶ。積はその次のsiteに置く。それより前の隙間が定数とsourceを保ち、
 * 積までの隙間が定数を保ち、符号拡張以降の隙間が出力registerに触れない、最初のsite。
 */
function extendSite(
  gaps: readonly (readonly RegisterFlow[])[],
  source: number,
  temporary: number,
  output: number,
): number | undefined {
  for (let site = 1; site < STEPS - 1; site++) {
    const keepsInputs = gaps.slice(0, site).flat().every((flow) =>
      !flow.writes.includes(temporary) && !flow.writes.includes(source)
    );
    const keepsConstant = gaps[site].every((flow) =>
      !flow.writes.includes(temporary)
    );
    const leavesOutput = gaps.slice(site).flat().every((flow) =>
      !touches(flow, output)
    );
    if (keepsInputs && keepsConstant && leavesOutput) return site;
  }
  return undefined;
}

export function buildFourSongsMultiply(
  wordAt: WordAt,
  group: RewriteGroup,
  songs: number,
  targets: Map<number, number>,
): void {
  assert(4 * songs <= MAX_IMMEDIATE, `N=${songs}の4Nは即値に収まりません`);
  const destinations = group.sites.map((address) => rdOf(wordAt(address)));
  const source = rtOf(wordAt(group.sites[0]));
  const temporary = destinations[0];
  const output = destinations[STEPS - 1];
  assert(
    temporary !== source && temporary !== output,
    "4N shiftの先頭がsourceか出力へ書いています",
  );
  const site = extendSite(
    gapFlows(wordAt, group, destinations),
    source,
    temporary,
    output,
  );
  assert(site !== undefined, `${hex(group.sites[0])}にmultを置けません`);
  for (const address of group.sites) targets.set(address, 0);
  targets.set(group.sites[0], addiu(temporary, reg.zero, 4 * songs));
  targets.set(group.sites[site], sll(output, source, 0));
  targets.set(group.sites[site + 1], mult(output, output, temporary));
}
