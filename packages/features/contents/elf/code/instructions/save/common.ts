/** セーブ配置の書き換えで共有する型と即値の小道具。 */

import { opOf } from "../../mips/mod.ts";
import type { SaveLayout } from "./layout.ts";

/** 参照表の1行。`built`は基底に足した組み立て済み定数、`producers`はその命令。 */
export type SaveDataReference = Readonly<{
  address: number;
  built: number;
  from: number;
  indexed: boolean;
  kind: "access" | "addiu" | "addu";
  producers: readonly number[];
  to: number;
  value: number;
}>;

/** 1命令の書き換え。`far`は新しい全offsetをstubで作る。 */
export type Patch = Readonly<{
  address: number;
  far?: number;
  newWord: number;
  usage: string;
}>;

export type Rewriter = Readonly<{
  layout: SaveLayout;
  wordAt(address: number): number;
  /** 共有`lui`の上位16bitを登録する。既に別の値で使われていればfalse。 */
  claimHigh(address: number, high: number): boolean;
}>;

export const fits16 = (value: number) => value >= -0x8000 && value <= 0x7fff;
export const isLui = (word: number) => opOf(word) === 0x0f;
export const isOri = (word: number) => opOf(word) === 0x0d;
export const isAddiu = (word: number) =>
  opOf(word) === 0x09 || opOf(word) === 0x19;
export const hex = (value: number) => "0x" + (value >>> 0).toString(16);

export function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
