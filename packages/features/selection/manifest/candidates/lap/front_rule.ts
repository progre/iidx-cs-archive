// 組の表(選曲リストに並ぶ曲)を、候補の曲の素材から規則で選ぶ。
// 規則は、専用ムービーを持つ曲、オーバーレイの多い曲、新しい世代の曲(us は最も古い)の順に比べる。

import type { ManifestSongDraft } from "@csa/core";

/** 表を選ぶために比べる、候補の曲の値 */
export interface FrontFacts {
  /** 汎用でないムービー(`movie_alias.csv`に無いムービー)を持つなら`true` */
  dedicatedMovie: boolean;
  /** 新しい世代ほど大きい値。us は最も小さい */
  newness: number;
  /** 演奏中に使うオーバーレイの枚数 */
  overlaySheets: number;
}

/** 曲のムービー。`世代:songmapの通し番号`の形で、`movie_alias.csv`のキーと同じ書き方である */
export const movieKeyOf = (generation: string, fileIndex: number): string =>
  generation + ":" + fileIndex;

/** 汎用のムービーだけなら偽。ムービーを持たない曲も偽である */
export const hasDedicatedMovie = (
  movies: readonly string[],
  isGeneric: (movie: string) => boolean,
): boolean => movies.some((movie) => !isGeneric(movie));

/**
 * 周回で作った曲の行が、CSA で使うムービー。
 * 1曲に2本のムービーを持つ作品では、CSA が使わない本目を`excluded`にしているので、数えない
 */
export const draftMoviesOf = (row: ManifestSongDraft): string[] =>
  row.sourceAssets
    .filter((asset) => asset.kind === "video" && asset.path !== "excluded")
    .map((asset) => movieKeyOf(row.sourceGeneration, asset.sourceFileIndex));

const compare = (a: FrontFacts, b: FrontFacts): number =>
  Number(b.dedicatedMovie) - Number(a.dedicatedMovie) ||
  b.overlaySheets - a.overlaySheets ||
  b.newness - a.newness;

/**
 * 規則で最も先に来る候補を返す。最も先の候補が2つ以上あれば、枠の持ち主を選び、持ち主が無ければ止める。
 * 候補が1つなら、値を引かずにそれを返す。周回で行を作らない曲も、1行だけの組になるからである。
 * `nameOf`はエラーメッセージで候補を指す
 */
export function pickFront<T>(
  candidates: readonly T[],
  owner: T,
  factsOf: (candidate: T) => FrontFacts,
  nameOf: (candidate: T) => string,
): T {
  if (candidates.length === 1) {
    return candidates[0];
  }
  const sorted = candidates.toSorted((a, b) => compare(factsOf(a), factsOf(b)));
  const best = sorted.filter((each) =>
    compare(factsOf(each), factsOf(sorted[0])) === 0
  );
  if (best.length === 1 || best.includes(owner)) {
    return best.length === 1 ? best[0] : owner;
  }
  throw new Error(
    `組の表を規則で選べない: ${best.map(nameOf).join(", ")}`,
  );
}

/** 組の候補の行。全曲リストの行で指す */
export interface GroupCandidate {
  generation: string;
  row: { line: number };
}

/** 規則で使う、曲のムービーとオーバーレイの枚数 */
export interface FrontMaterial {
  movies: string[];
  overlaySheets: number;
}

export interface FrontRulePorts {
  isGenericMovie: (movie: string) => boolean;
  /** 新しい世代ほど大きい値。us は最も小さい */
  newnessOf: (generation: string) => number;
  /** PB 原盤の曲は周回の行を持たないので、全曲リストの行番号から引く */
  pbMaterialAt: (line: number) => FrontMaterial;
}

/** 周回で作った行の、規則で使う値。全曲リストで外した行も、下書きを持つ */
function draftMaterialAt(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  { generation, row }: GroupCandidate,
): FrontMaterial {
  const draft = rowsOf.get(generation)?.find((each) =>
    each.catalogLine === row.line
  );
  if (draft?.sourceOverlay === undefined) {
    throw new Error(`${generation}の全曲リスト line ${row.line}: 下書きが無い`);
  }
  return {
    movies: draftMoviesOf(draft),
    overlaySheets: draft.sourceOverlay.sheets,
  };
}

/** すべての世代を読み終えた後に、周回で作った行から組の表を選ぶ関数を作る */
export function ruleFrontChooser(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  ports: FrontRulePorts,
) {
  const factsOf = (candidate: GroupCandidate): FrontFacts => {
    const { movies, overlaySheets } = candidate.generation === "pb"
      ? ports.pbMaterialAt(candidate.row.line)
      : draftMaterialAt(rowsOf, candidate);
    return {
      dedicatedMovie: hasDedicatedMovie(movies, ports.isGenericMovie),
      newness: ports.newnessOf(candidate.generation),
      overlaySheets,
    };
  };
  return <T extends GroupCandidate>(candidates: readonly T[], owner: T): T =>
    pickFront(
      candidates,
      owner,
      factsOf,
      ({ generation, row }) => `${generation} line ${row.line}`,
    );
}
