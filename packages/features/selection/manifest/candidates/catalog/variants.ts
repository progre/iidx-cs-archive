// 全曲リストで表の曲を書いた行の組を、世代の行の裏エントリーに結ぶ。

import type {
  CatalogRow,
  CatalogVariant,
  ManifestSongDraft,
  SongVariant,
} from "@csa/core";
import { titleOf } from "./tables.ts";

/** エラーメッセージで、裏の曲の行を指す */
const whereOf = ({ generation, line }: CatalogVariant) =>
  `${generation}の全曲リスト line ${line}`;

/** 全曲リストの`title`列の書き方から曲番号を引く。無ければ`where`の行を示して止める */
export function songIdOf(
  rows: ReadonlyMap<number, CatalogRow> | undefined,
  title: string,
  where: string,
): number {
  const found = [...rows ?? []].find(([, row]) => titleOf(row) === title);
  if (found === undefined) {
    throw new Error(`${where}: 全曲リストに${title}が無い`);
  }
  return found[0];
}

/**
 * 別の世代の全曲リストは、その世代の周回まで読まないので、表の曲のsong_idが分からない。
 * 周回の中の並びは、裏かどうかだけで決まる。
 * そこで周回の中では、表の曲のsong_idを仮の値にする。
 * 周回の後で、`withOtherGenerationFronts`が正しいsong_idに書き直す。
 * 全曲リストに同じ曲を2行書くと、その2行は裏の曲の番号が同じになる。
 * どの行を書き直すかを取り違えないように、仮の値は行番号から作る負の数にする
 */
const pendingFrontOf = (variant: CatalogVariant) => -variant.line;

const isOtherGeneration = (variant: CatalogVariant) =>
  variant.frontGeneration !== variant.generation;

/** 裏の曲の行の組。`songId`は裏の曲の曲番号 */
export interface RowVariant {
  songId: number;
  variant: SongVariant;
}

/**
 * 組から、全曲リストの行番号 → 裏の曲と条件、を引く表を作る。
 * 同じ曲を2行に書いた写しがあるので、曲番号でなく行番号で引く。
 * 表の曲が別の世代なら、song_idは`pendingFrontOf`の仮の値にしておく
 */
export function variantsOf(
  generation: string,
  rows: ReadonlyMap<number, CatalogRow>,
  variants: readonly CatalogVariant[],
): Map<number, RowVariant> {
  return new Map(
    variants.filter((variant) => variant.generation === generation).map(
      (variant) => {
        const other = isOtherGeneration(variant);
        const where = whereOf(variant);
        const back = songIdOf(rows, variant.title, where);
        const front = other
          ? pendingFrontOf(variant)
          : songIdOf(rows, variant.frontTitle, where);
        const { rule } = variant;
        return [variant.line, {
          songId: back,
          variant: {
            ...(rule?.kind === "previousSong"
              ? { afterSongId: songIdOf(rows, rule.after, where) }
              : {}),
            ...(variant.frontCharts === undefined
              ? {}
              : { frontCharts: variant.frontCharts }),
            ...(other ? { generation: variant.frontGeneration } : {}),
            frontLine: variant.frontLine,
            ...(variant.position === undefined
              ? {}
              : { position: variant.position }),
            rule: rule?.kind ?? "custom",
            songId: front,
          },
        }];
      },
    ),
  );
}

/** 表の曲を書いた裏の曲が、世代の行に載らなかったら止める */
export function assertVariantsBuilt(
  variants: ReadonlyMap<number, RowVariant>,
  rows: readonly ManifestSongDraft[],
): void {
  const missing = [...variants.values()]
    .map(({ songId }) => songId)
    .filter((songId) => !rows.some((row) => row.sourceSongIndex === songId));
  if (missing.length > 0) {
    throw new Error(
      `表の曲を書いた裏の曲が収録されない: song_id ${missing.join(", ")}`,
    );
  }
}

/** 表の曲を全曲リストで外していれば、裏の曲は載らないので止める */
function includedFrontOf(
  variant: CatalogVariant,
  rows: ReadonlyMap<number, CatalogRow> | undefined,
): number {
  const { frontGeneration, frontTitle } = variant;
  const where = whereOf(variant);
  const songId = songIdOf(rows, frontTitle, where);
  if (rows?.get(songId)?.exclude) {
    throw new Error(
      `${where}: ${frontGeneration}の全曲リストで${frontTitle}を外している`,
    );
  }
  return songId;
}

/**
 * 表の曲を裏と別の世代にした組を扱う。
 * 表の曲のsong_idは、表の曲がある世代を読み終えるまで分からない。
 * このため、すべての世代を読み終えた後に、表の曲のsong_idを裏の行の`variantOf`に書く
 */
export function withOtherGenerationFronts(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  variants: readonly CatalogVariant[],
): Map<string, ManifestSongDraft[]> {
  const result = new Map([...rowsOf].map(([gen, rows]) => [gen, [...rows]]));
  // PB 原盤の曲の写しの裏は下書きを持たないので、`withPbSlotFronts`が扱う
  const others = variants.filter((variant) =>
    isOtherGeneration(variant) && variant.generation !== "pb"
  );
  for (const variant of others) {
    const { generation } = variant;
    const where = whereOf(variant);
    const back = songIdOf(catalogRows.get(generation), variant.title, where);
    const front = includedFrontOf(
      variant,
      catalogRows.get(variant.frontGeneration),
    );
    const rows = result.get(generation) ?? [];
    const at = rows.findIndex((row) =>
      row.sourceSongIndex === back &&
      row.variantOf?.songId === pendingFrontOf(variant)
    );
    if (at < 0) {
      throw new Error(`${where}: 裏の曲が行に無い`);
    }
    const variantOf = rows[at].variantOf as SongVariant;
    rows[at] = { ...rows[at], variantOf: { ...variantOf, songId: front } };
  }
  return result;
}
