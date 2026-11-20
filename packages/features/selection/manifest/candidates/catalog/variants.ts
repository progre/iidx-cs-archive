// 全曲リストで書いた組を、すべての世代を読み終えた後に、世代の行の裏エントリーに結ぶ。
// 表か裏かは周回の後に決めるので、周回の中の行は組の条件を持たない。

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

/** 表の曲の曲番号。表の曲を全曲リストで外していれば、裏の曲は載らないので止める */
export function includedSongIdOf(
  rows: ReadonlyMap<number, CatalogRow> | undefined,
  generation: string,
  title: string,
  where: string,
): number {
  const songId = songIdOf(rows, title, where);
  if (rows?.get(songId)?.exclude) {
    throw new Error(
      `${where}: ${generation}の全曲リストで${title}を外している`,
    );
  }
  return songId;
}

/** 世代の行のうち、全曲リストの`line`行目から作った行の位置。無ければ`where`の行を示して止める */
export function rowAtLine(
  rows: readonly ManifestSongDraft[],
  line: number,
  where: string,
): number {
  const at = rows.findIndex((row) => row.catalogLine === line);
  if (at < 0) {
    throw new Error(`${where}: 全曲リストの行の曲が、世代の行に無い`);
  }
  return at;
}

function songVariantOf(
  variant: CatalogVariant,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
): SongVariant {
  const where = whereOf(variant);
  const { frontGeneration, generation, rule } = variant;
  return {
    ...(rule?.kind === "previousSong"
      ? {
        afterSongId: songIdOf(catalogRows.get(generation), rule.after, where),
      }
      : {}),
    ...(variant.chartMoves === undefined
      ? {}
      : { chartMoves: variant.chartMoves }),
    ...(frontGeneration === generation ? {} : { generation: frontGeneration }),
    frontLine: variant.frontLine,
    ...(variant.position === undefined ? {} : { position: variant.position }),
    rule: rule?.kind ?? "custom",
    songId: includedSongIdOf(
      catalogRows.get(frontGeneration),
      frontGeneration,
      variant.frontTitle,
      where,
    ),
  };
}

/**
 * 裏の曲の行に、差し替え元の曲と条件を書く。
 * 裏の曲は、表の曲の中で譜面を移さないので、行の`chartMoves`を外す。組は裏の条件に入れる。
 * 裏の曲が組のセーブの枠の持ち主なら、原作の5鍵盤版を表の曲に結び直す。
 * PB 原盤の曲の写しの裏は下書きを持たないので、`withPbSlotFronts`が扱う
 */
export function withCatalogVariants(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>,
  variants: readonly CatalogVariant[],
): Map<string, ManifestSongDraft[]> {
  const result = new Map([...rowsOf].map(([gen, rows]) => [gen, [...rows]]));
  for (const variant of variants.filter((each) => each.generation !== "pb")) {
    const where = whereOf(variant);
    const rows = result.get(variant.generation) ?? [];
    const at = rowAtLine(rows, variant.line, where);
    const { chartMoves: _, ...back } = rows[at];
    rows[at] = { ...back, variantOf: songVariantOf(variant, catalogRows) };
    result.set(variant.generation, rows);
    if (variant.slotOwner) {
      const fronts = result.get(variant.frontGeneration) ?? [];
      withTwinMoved(
        result,
        back,
        fronts[rowAtLine(fronts, variant.frontLine, where)],
      );
    }
  }
  return result;
}

/**
 * 原作の5鍵盤版は、原盤の定義で同じ世代の表の曲と組になる。
 * 表が枠の持ち主から別の曲に替わったら、5鍵盤版を新しい表の曲に結ぶ。
 * 新しい表は持ち主の曲indexに置くので、5鍵盤版が指す曲indexは変わらない
 */
function withTwinMoved(
  rowsOf: Map<string, ManifestSongDraft[]>,
  owner: ManifestSongDraft,
  front: ManifestSongDraft,
): void {
  const generation = owner.sourceGeneration;
  const rows = rowsOf.get(generation) ?? [];
  rows.forEach((row, at) => {
    const fiveKey = row.fiveKeyOf;
    if (
      fiveKey === undefined || fiveKey.generation !== undefined ||
      fiveKey.songId !== owner.sourceSongIndex
    ) {
      return;
    }
    rows[at] = {
      ...row,
      fiveKeyOf: {
        ...fiveKey,
        ...(front.sourceGeneration === generation
          ? {}
          : { generation: front.sourceGeneration }),
        songId: front.sourceSongIndex,
      },
    };
  });
}
