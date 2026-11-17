// ムービーの別名の表(`data/movie_alias.csv`)を読む。
// 同じ汎用ムービーでも世代ごとに番号が違うので、同じ別名を付けて同じものだと分かるようにする。
// `pick`に`*`を書いた1本は、同じ別名のムービーを使う曲が採用する1本である。

import { parse } from "@std/csv";

const HEADER = ["generation", "id", "alias", "pick"];
const PICK = "*";

interface MovieAliasRow {
  alias: string;
  generation: string;
  id: number;
  line: number;
  picked: boolean;
}

function rowsOf(text: string): MovieAliasRow[] {
  const [header, ...rows] = parse(text);
  if (header?.join(",") !== HEADER.join(",")) {
    throw new Error(`line 1: unexpected header: ${header?.join(",")}`);
  }
  const movies = new Set<string>();
  return rows.map((cells, index) => {
    const line = index + 2;
    const [generation, id, alias, pick] = cells;
    if (
      cells.length !== HEADER.length ||
      [generation, id, alias].some((cell) => cell === "")
    ) {
      throw new Error(`line ${line}: 世代・番号・別名を書く`);
    }
    if (pick !== "" && pick !== PICK) {
      throw new Error(`line ${line}: pickには${PICK}を書く`);
    }
    const movie = generation + ":" + id;
    if (movies.has(movie)) {
      throw new Error(`line ${line}: ${movie}の別名を2回書いている`);
    }
    movies.add(movie);
    return { alias, generation, id: Number(id), line, picked: pick === PICK };
  });
}

/** `世代:番号` → 別名 */
export const parseMovieAliases = (text: string): Map<string, string> =>
  new Map(
    rowsOf(text).map(({ alias, generation, id }) => [
      generation + ":" + id,
      alias,
    ]),
  );

/** 別名 → `pick`に`*`を書いた1本 */
export function parseMoviePicks(
  text: string,
): Map<string, { generation: string; id: number }> {
  const picks = new Map<string, { generation: string; id: number }>();
  const picked = rowsOf(text).filter(({ picked }) => picked);
  for (const { alias, generation, id, line } of picked) {
    if (picks.has(alias)) {
      throw new Error(`line ${line}: 別名${alias}のpickを2行に書いている`);
    }
    picks.set(alias, { generation, id });
  }
  return picks;
}
