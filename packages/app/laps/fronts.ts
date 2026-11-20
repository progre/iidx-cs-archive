// 全世代の周回の後に、組の表を規則で選ぶ。
// 表の行が変わると副題を寄せる行も変わるので、世代の全曲リストの行を引き直す。

import type { PbSong } from "@csa/report-song-list";
import type { CatalogRow, ManifestSongDraft } from "@csa/core";
import { movieKeyOf, ruleFrontChooser } from "@csa/selection-manifest";
import { GENERATIONS } from "@csa/selection-definitions";
import { readMovieAliases } from "@csa/selection-song-catalog";
import { catalogRowsOf, useFrontChooser } from "../ports/song/mod.ts";

/** 新しい世代ほど大きい値。us は最も古く、PB は最も新しい */
const newnessOf = (generation: string): number =>
  generation === "us"
    ? -1
    : generation === "pb"
    ? GENERATIONS.length
    : GENERATIONS.indexOf(generation);

/** PB 原盤の曲を、全曲リストの行番号から引く */
function pbSongAt(
  catalogRows: ReadonlyMap<number, CatalogRow> | undefined,
  pbSongs: readonly PbSong[],
  line: number,
): PbSong {
  const songId = [...catalogRows ?? []].find(([, row]) => row.line === line)
    ?.[0];
  const found = pbSongs.find(({ song }) => song.song_id === songId);
  if (found === undefined) {
    throw new Error(`pbの全曲リスト line ${line}: PB原盤の曲が無い`);
  }
  return found;
}

/**
 * 組の表を規則で選ぶようにし、`catalogRows`の行を、新しい表に副題を寄せた行に替える。
 * `elfOf`は、世代の曲DBを持つ実行ファイルを返す
 */
export function settleFronts(
  rowsOf: ReadonlyMap<string, readonly ManifestSongDraft[]>,
  catalogRows: Map<string, Map<number, CatalogRow>>,
  pbSongs: readonly PbSong[],
  elfOf: (generation: string) => Uint8Array,
): void {
  const aliases = readMovieAliases();
  useFrontChooser(ruleFrontChooser(rowsOf, {
    isGenericMovie: (movie) => aliases.has(movie),
    newnessOf,
    pbMaterialAt: (line) => {
      const { overlay, song } = pbSongAt(catalogRows.get("pb"), pbSongs, line);
      return {
        movies: song.videos.map((index) => movieKeyOf("pb", index)),
        overlaySheets: overlay.sheets,
      };
    },
  }));
  for (const generation of [...catalogRows.keys()]) {
    catalogRows.set(generation, catalogRowsOf(generation, elfOf(generation)));
  }
}
