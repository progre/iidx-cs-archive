// 識別子と音のハッシュの欄。1つの欄に複数の値を、1行に1つずつ並べる。

import type { SoundPrint, SoundPrintKind } from "@csa/core";
import type { SongListData } from "../types.ts";
import type { Sharing } from "./sharing.ts";

export interface RefsView {
  /**
   * 識別子の組ごとに行を分ける。組の中では矢印の前で改行し、行の頭に矢印を置く。
   * 共有する曲数は、組の最後の行の次に置く
   */
  lines: string[];
  title: string;
}

export interface Ref<Key> {
  key: Key;
  label: string;
}

/**
 * 資産の識別子。括弧内の曲数は、同じ識別子を持つ行の数である。
 * 共有している曲は、この一覧の中で同じ識別子を探せば見つかる。
 * 曲名を並べると行が長くなるので、曲名はツールチップに出す。
 */
export function refsView<Key>(
  refs: readonly Ref<Key>[],
  sharing: Sharing<Key>,
): RefsView | null {
  if (refs.length === 0) return null;
  const songsOf = (key: Key) => sharing.get(key) ?? [];
  return {
    lines: refs.flatMap((ref) => {
      const shared = songsOf(ref.key).length;
      const lines = ref.label.split(/ (?=→ )/);
      return shared <= 1 ? lines : [...lines, "(" + shared + "曲で共有)"];
    }),
    title: refs
      .map((ref) => ref.label + ": " + songsOf(ref.key).join(", "))
      .join(" / "),
  };
}

/**
 * 種類が`kind`の音について、`part`で選んだハッシュをファイルごとに1行ずつ並べる。
 * ヘッダーの無い形式は、ヘッダーの行を`—`にする
 */
export function soundPrintLines(
  sounds: readonly string[],
  prints: SongListData["soundPrints"],
  kind: SoundPrintKind,
  part: "body" | "header",
): string[] {
  return sounds
    .map((source): SoundPrint => {
      const print = prints.get(source);
      if (print === undefined) {
        throw new Error(`音${source}のハッシュを求めていない`);
      }
      return print;
    })
    .filter((print) => print.kind === kind)
    .map((print) => print[part] ?? "—");
}
