/**
 * 参照表1行(score基底の参照)を新配置の命令語に写す。
 *
 * - `lui`(+`ori`)で組み立てた定数を基底に足す形は built.ts が写す。
 * - 基底そのものに足す`addiu`と即値accessは絶対offsetとして写像する。
 * - 曲stride由来の即値は曲数に比例させる。要素内の差は変えない。
 * - 16bitに収まらない即値は`far`として返し、stub側(song_value)で上位を作る。
 */

import { withImmediate } from "../../mips/mod.ts";
import { rewriteBuilt } from "./built.ts";
import {
  assert,
  fits16,
  hex,
  type Patch,
  type Rewriter,
  type SaveDataReference,
} from "./common.ts";
import { isStride, mapOffset, scaleStride } from "./layout.ts";

/** 絶対offsetの即値(基底そのものに足す`addiu`または即値access)。 */
function rewriteAbsolute(
  rewriter: Rewriter,
  row: SaveDataReference,
  offset: number,
): Patch[] {
  const target = mapOffset(rewriter.layout, offset);
  assert(target !== null, "参照先が配置外: " + hex(row.address));
  const word = rewriter.wordAt(row.address);
  if (fits16(target)) {
    return [{
      address: row.address,
      newWord: withImmediate(word, target),
      usage: "absolute",
    }];
  }
  return [{
    address: row.address,
    far: target,
    newWord: word,
    usage: "far_absolute",
  }];
}

function rewriteRelative(rewriter: Rewriter, row: SaveDataReference): Patch[] {
  if (!isStride(row.value)) return [];
  const scaled = scaleStride(rewriter.layout, row.value);
  const word = rewriter.wordAt(row.address);
  if (fits16(scaled)) {
    return [{
      address: row.address,
      newWord: withImmediate(word, scaled),
      usage: "stride",
    }];
  }
  assert(
    row.kind === "addiu",
    "strideのaccessが16bitに収まらない: " + hex(row.address),
  );
  // `addiu rt, rs, stride`。基底register相対なので、stubが`at`に全体を作って足す。
  return [{
    address: row.address,
    far: scaled,
    newWord: word,
    usage: "far_stride",
  }];
}

export function rewriteRow(
  rewriter: Rewriter,
  row: SaveDataReference,
  consumedProducers: Set<number>,
): Patch[] {
  if (row.kind === "access") {
    if (row.producers.length > 0) {
      for (const producer of row.producers) consumedProducers.add(producer);
      return rewriteBuilt(rewriter, row);
    }
    if (row.from === 0) return rewriteAbsolute(rewriter, row, row.value);
    return rewriteRelative(rewriter, row);
  }
  if (row.kind === "addiu") {
    if (isStride(row.value)) return rewriteRelative(rewriter, row);
    if (row.from === 0 && !row.indexed) {
      return rewriteAbsolute(rewriter, row, row.value);
    }
    return [];
  }
  // addu: pointerの形成。accessが同じ組み立てを使っていれば処理済み。
  // 組み立て元が無い定数(dataから読んだ値など)は即値を持たないので、ここでは扱えない。
  // 基底側が動くpointer(style・rowを足した後)でも、定数はscore先頭からの成分なので写す。
  if (row.producers.some((producer) => consumedProducers.has(producer))) {
    return [];
  }
  if (row.producers.length === 0) return [];
  for (const producer of row.producers) consumedProducers.add(producer);
  return rewriteBuilt(rewriter, { ...row, from: 0, to: row.value, value: 0 });
}
