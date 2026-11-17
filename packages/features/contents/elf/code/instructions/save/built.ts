/**
 * `lui`(+`ori`)で組み立てた定数を基底に足してから即値で触る参照の写し。
 * 参照先offsetを写像し、`lui`/`ori`と最後の即値に分け直す。`ori`は零拡張、
 * 単独の`lui`は符号付き即値と組む。同じ`ori`に別経路から届く`lui`は全て同じ上位にする。
 */

import { rsOf, withImmediate } from "../../mips/mod.ts";
import {
  assert,
  fits16,
  hex,
  isAddiu,
  isLui,
  isOri,
  type Patch,
  type Rewriter,
  type SaveDataReference,
} from "./common.ts";
import { isStride, mapOffset, scaleStride } from "./layout.ts";

type Producers = Readonly<{
  /** `li rt, K`(`ori`/`addiu`で`rs`が`zero`)。 */
  loads: number[];
  luis: number[];
  oris: number[];
}>;

function classify(rewriter: Rewriter, producers: readonly number[]): Producers {
  const result = {
    loads: [] as number[],
    luis: [] as number[],
    oris: [] as number[],
  };
  for (const address of producers) {
    const word = rewriter.wordAt(address);
    const fromZero = rsOf(word) === 0;
    if (isLui(word)) result.luis.push(address);
    else if ((isOri(word) || isAddiu(word)) && fromZero) {
      result.loads.push(address);
    } else if (isOri(word)) result.oris.push(address);
    // `rs != zero`の`addiu`はループの段差で、定数の一部ではない。
  }
  return result;
}

/**
 * `lui`群と`ori`の組で定数`value`を作る。`ori`は零拡張なので上位はそのまま。
 * `lui`を別の定数と共有していて上位が揃わなければ、`ori`をstubにして定数全体を作り直す。
 */
function encodePair(
  rewriter: Rewriter,
  luis: readonly number[],
  ori: number,
  value: number,
): Patch[] {
  assert(value >= 0 && value <= 0xffffffff, "定数が32bitに収まらない");
  if (!luis.every((lui) => rewriter.claimHigh(lui, value >>> 16))) {
    return [{
      address: ori,
      far: value,
      newWord: rewriter.wordAt(ori),
      usage: "far_constant",
    }];
  }
  return [
    ...luis.map((lui) => ({
      address: lui,
      newWord: withImmediate(rewriter.wordAt(lui), value >>> 16),
      usage: "lui",
    })),
    {
      address: ori,
      newWord: withImmediate(rewriter.wordAt(ori), value & 0xffff),
      usage: "ori",
    },
  ];
}

/**
 * 組み立てた定数`K`を基底に足し、ループの段差(小さな`addiu`)を経て即値で触る参照。
 * 参照先`O`は段差込みの`to`を使う。合流で基底が崩れた行(段差が要素より大きい)は
 * `K + 即値`を参照先とみなす。新しい定数は`map(O) - (O - K)`で、段差と即値を保つ。
 * 即値がstride(row 1以降を指す)なら即値側を曲数に比例させ、定数は基底のまま写す。
 */
export function rewriteBuilt(
  rewriter: Rewriter,
  row: SaveDataReference,
): Patch[] {
  const { loads, luis, oris } = classify(rewriter, row.producers);
  const steps = row.to - row.built - row.value;
  const offset = steps >= 0 && steps < 0x100 ? row.to : row.built + row.value;
  const strideImmediate = isStride(row.value);
  const reach = strideImmediate ? offset - row.value : offset;
  const target = mapOffset(rewriter.layout, reach);
  assert(target !== null, "参照先が配置外: " + hex(row.address));
  const constant = target - (reach - row.built);
  const word = rewriter.wordAt(row.address);
  const patches: Patch[] = [];
  if (strideImmediate) {
    const immediate = scaleStride(rewriter.layout, row.value);
    assert(fits16(immediate), "strideの即値が届かない: " + hex(row.address));
    patches.push({
      address: row.address,
      newWord: withImmediate(word, immediate),
      usage: "stride",
    });
  }
  if (luis.length > 0 && oris.length === 1) {
    return [...patches, ...encodePair(rewriter, luis, oris[0], constant)];
  }
  if (luis.length > 0 && oris.length === 0 && loads.length === 0) {
    // luiだけで上位を作り、符号付きの即値で届く形。即値も動かして届かせる。
    assert(!strideImmediate, "lui単独とstride即値の組は扱えない");
    const high = ((constant + row.value + 0x8000) >>> 16) & 0xffff;
    const low = constant + row.value - (high << 16);
    assert(fits16(low), "lui単独の下位が届かない: " + hex(row.address));
    assert(
      luis.every((lui) => rewriter.claimHigh(lui, high)),
      "lui単独の共有が割れる: " + hex(row.address),
    );
    return [
      ...luis.map((lui) => ({
        address: lui,
        newWord: withImmediate(rewriter.wordAt(lui), high),
        usage: "lui",
      })),
      { address: row.address, newWord: withImmediate(word, low), usage: "lo" },
    ];
  }
  if (loads.length === 1 && luis.length === 0 && oris.length === 0) {
    const first = loads[0], firstWord = rewriter.wordAt(first);
    const immediate = firstWord & 0xffff;
    const limit = isOri(firstWord) ? 0xffff : 0x7fff;
    if (isStride(immediate)) {
      // `li rt, stride`。掛け算やshiftでstrideを作る形なので、offsetではなく倍率で写す。
      const scaled = scaleStride(rewriter.layout, immediate);
      return scaled <= limit
        ? [{
          address: first,
          newWord: withImmediate(firstWord, scaled),
          usage: "stride_li",
        }]
        : [{
          address: first,
          far: scaled,
          newWord: firstWord,
          usage: "far_constant",
        }];
    }
    // 即値が倍にされて定数になった形(`li rt, 3`にstrideを掛けるなど)。乗数は曲数に依らない。
    if (immediate !== (row.built & 0xffff)) return patches;
    // `li rt, K`。16bitに収まらなければstubで作る。
    if (constant >= 0 && constant <= limit) {
      return [...patches, {
        address: first,
        newWord: withImmediate(firstWord, constant),
        usage: "ori",
      }];
    }
    return [...patches, {
      address: first,
      far: constant,
      newWord: firstWord,
      usage: "far_constant",
    }];
  }
  throw new Error("組み立ての形を扱えない: " + hex(row.address));
}
