// 音のbundleを書く処理が使う、他の feature の関数。実装は app が渡す。

import type { SoundKind, SoundRules } from "../convert/mod.ts";

/**
 * bundleに書いた音の一覧を、書いた順に保持する。
 * 原盤の同じ範囲の音は、2度目以降はbundleへ書かない
 */
export interface SoundOccurrenceList<T, O> {
  /** 並びに加える。バイト列をbundleへ書くべきなら`true`を返す */
  add(
    target: T,
    converted: { size: number; soundMap?: Record<string, number> },
    unchanged: boolean,
  ): boolean;
  readonly list: O[];
}

export interface SoundBundlePorts<T, O> {
  /** 書く音の種別 */
  kindOf(target: T): SoundKind;
  /** 前のビルドと並びが同じかを比べる鍵 */
  keyOf(target: T): string;
  newOccurrences(): SoundOccurrenceList<T, O>;
  /** 原盤から読んだ音を、変換する前に受け取る。同じ範囲の音は1度だけ渡す */
  onRead(target: T, raw: Uint8Array): Promise<void>;
  /** 音を置いたアーカイブと、その中の範囲 */
  placeOf(
    target: T,
  ): { archiveName: string; offset: number; size: number };
  rules: SoundRules;
}
