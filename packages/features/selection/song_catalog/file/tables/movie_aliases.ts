// ムービーの別名の表(`data/movie_alias.csv`)を読む。
// 同じ汎用ムービーでも世代ごとに番号が違うので、同じ別名を付けて同じものだと分かるようにする。
// どの1本を収録するかは表に書かず、ビルドが規則で選ぶ(`selection/manifest`の`alias_rule.ts`)。

import { parse } from "@std/csv";

const HEADER = ["generation", "id", "alias"];

/** `世代:番号` → 別名。並びは表の行の順である */
export function parseMovieAliases(text: string): Map<string, string> {
  const [header, ...rows] = parse(text);
  if (header?.join(",") !== HEADER.join(",")) {
    throw new Error(`line 1: unexpected header: ${header?.join(",")}`);
  }
  const aliases = new Map<string, string>();
  rows.forEach((cells, index) => {
    const line = index + 2;
    const [generation, id, alias] = cells;
    if (
      cells.length !== HEADER.length ||
      [generation, id, alias].some((cell) => cell === "")
    ) {
      throw new Error(`line ${line}: 世代・番号・別名を書く`);
    }
    const movie = generation + ":" + Number(id);
    if (aliases.has(movie)) {
      throw new Error(`line ${line}: ${movie}の別名を2回書いている`);
    }
    aliases.set(movie, alias);
  });
  return aliases;
}
