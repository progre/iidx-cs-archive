// 追加のバージョン別フォルダーを差し込む原盤の命令の位置。

import { STUB_SLOTS } from "../../../data/stub_area/mod.ts";
import { reg } from "../../mips/mod.ts";

/**
 * 枠kの代わりに渡す負の値を返す。
 * 本体は、枠に`5レコード長`を掛けて番地を作る。掛け算は32bitで行われる。
 * 5レコード長の下位の0がtビットなら、掛けた結果は枠が`2^(32 - t)`違っても変わらない。
 * そこでkから`2^(32 - t)`を引いた値を返す
 */
export function wrappedSlot(slot: number, recordSize: number): number {
  const stride = 5 * recordSize;
  const trailingZeros = 31 - Math.clz32(stride & -stride);
  return slot - 2 ** (32 - trailingZeros);
}

/** 追加フォルダーの分類番号。原盤は0x48まで使い、0x49は空いている */
export const ADDED_CATEGORY = 0x49;
/** 一覧でこの分類の直後に置く(原盤のバージョン別の最後の枠) */
export const PRECEDING_CATEGORY = 0x10;
/** この作品番号以上の曲を追加フォルダーへ入れる */
export const FIRST_ADDED_VERSION = 16;
/** 分類で引く表を延ばしたあとの件数。追加の分類の行を含む */
export const TABLE_ENTRIES = ADDED_CATEGORY + 1;

export const ADDED_SLOT = STUB_SLOTS.addedFolder;

/**
 * 差し込む関数の入口の番地。対象は、分類(`a1`)で分岐してレコードを引く関数である。
 * 入口の先頭2語はスタブへ移す。
 * 分類がADDED_CATEGORYのとき、スタブは分類を`wrappedSlot`の負の値に置き換える。
 * 負の値なので、原盤のバージョン別の判定(`< 0x11`)を通る。
 * 本体が作る番地は、枠kのレコードを指す。
 * このため本体は、他の段の書き換えを含めて原盤のまま使える
 */
export interface EntryHook {
  entry: number;
  name: string;
}

export const ENTRY_HOOKS: readonly EntryHook[] = [
  { entry: 0x20ee50, name: "件数" },
  { entry: 0x20dd90, name: "表示用の複写" },
  { entry: 0x20f180, name: "表示状態" },
  { entry: 0x20d250, name: "集計" },
];

/** `VERSION_FUNCTION`の3回目の呼び出し。ここで得た作品番号から、枠のレコードを作る */
export const VERSION_CALL = 0x20fd14;
export const VERSION_FUNCTION = 0x1df790;
/** 選曲ワーク作成処理が、全レコードを`INIT_FUNCTION`で初期化する呼び出し */
export const INIT_CALL = 0x20d9e4;
export const INIT_FUNCTION = 0x210ec0;

/** フォルダー一覧を組むループの末尾のカウンター加算。`top`へ戻り、`exit`で抜ける */
export interface ListLoop {
  counter: number;
  site: number;
  top: number;
}

export const LIST_LOOPS: readonly ListLoop[] = [
  { counter: reg.s0, site: 0x18efe0, top: 0x18eeb4 },
  { counter: reg.s3, site: 0x188564, top: 0x1884dc },
  { counter: reg.s1, site: 0x18bc68, top: 0x18bb40 },
];
/** 原盤の一覧の分類の上限(この値の手前まで見る) */
export const LIST_END = 0x3a;
/**
 * 一覧に並べない分類。原盤の一覧は最大58件で、追加の分類を足すと溢れうる。
 * 条件付きでしか出ない特別な項目の枠を譲ってもらう(2026-09-23 ユーザー決定)
 */
export const SKIPPED_CATEGORY = 0x38;

/**
 * 表示状態を引く関数が、分類を一覧の`分類`番目の値から読んでいる箇所。
 * 全フォルダーが並ぶときだけ分類そのものと一致するので、ループの分類`s3`を渡す形に直す
 */
export const STATE_CATEGORY_SITE = 0x188518;

/** 分類→表示可否のグループを返す関数。先頭2語を替える */
export const GROUP_SITE = 0x1d4d80;
export const GROUP_RETURN = 0x1d4ea0;
/** バージョン別のグループ */
export const VERSION_GROUP = 2;

/** 0x39より大きい分類ではRANDOMを置かない判定の分岐 */
export const RANDOM_SITE = 0x18c78c;
export const RANDOM_TAKEN = 0x18c7ac;
export const RANDOM_BOUND = 0x3a;

/**
 * セレクトを押したときの分岐。分類が0x11未満かどうかで、難易度を替える範囲を決める。
 * 分岐するとフォルダー全体、しないと分類の範囲を続けて見て曲ごとに替える
 */
export const SELECT_SITE = 0x18938c;
/** 原盤のバージョン別の分類の上限(この値の手前まで) */
export const VERSION_END = 0x11;
export const SELECT_FOLDER = 0x189594;
export const SELECT_REST = 0x189398;
