// 曲リストHTMLの行を組み立てる。曲名順に並べ、裏エントリーと5鍵盤版は表の曲の直後へ移す。
// 行ごとに収録フォルダーを決める。
// 行の並び・レベル・収録フォルダーは、曲DBの値から決める。そうすれば、実機の選曲リストと同じものになる。
// 表示する曲名だけは素材のままで、原作の大文字小文字が残る。

import type { RowPorts } from "../../ports.ts";
import type { SongRow, Video } from "../../types.ts";
import { excludedRowOf } from "./excluded_row.ts";
import type { SongListInput } from "../input.ts";
import { pbRowsOf, withPbBacks } from "./pb_rows.ts";
import {
  assertBackFolders,
  FIVE_KEYS,
  variantForOf,
  withFrontsFirst,
} from "./relations.ts";
import {
  chartsOf,
  folderFieldsOf,
  folderTextOf,
  type FrontFill,
  hasNotes,
  overlayOf,
  type SortedRow,
  splitMoves,
  withFrontFills,
  withLinkedCharts,
  withMovedCharts,
} from "./row_fields.ts";
import { bytesOfLengths, pbVideo, sharedSoundsOf, songSize } from "../sizes.ts";

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

type AddedSong = SongListInput["manifest"]["songs"][number];

/** 曲が持つ譜面。外した譜面も、ノーツ数があれば含める */
function ownChartsOf(song: AddedSong): SongRow["charts"] {
  const excludedCharts = song.excludedCharts ?? [];
  return chartsOf(
    song.shown,
    song.chartPrints,
    (name) =>
      song.chartNames.includes(name) ||
      (excludedCharts.includes(name) && hasNotes(song.shown)(name)),
    excludedCharts,
  );
}

/** 裏の曲の、表の曲にも写す組を、表の曲の枠で引けるようにする。裏の番号の順に並べる */
function frontFillsOf(songs: readonly AddedSong[]): FrontFill[] {
  return songs
    .toSorted((a, b) =>
      (a.variantOf?.position ?? 0) - (b.variantOf?.position ?? 0)
    )
    .flatMap((song) => {
      const variant = song.variantOf;
      const charts = ownChartsOf(song);
      return splitMoves(variant).fills.flatMap(
        ([name, from]) => {
          const chart = charts[from];
          return chart === undefined || variant === undefined ? [] : [{
            chart: {
              ...chart,
              from: { chart: from, generation: song.sourceGeneration },
            },
            name,
            saveIndex: variant.targetSongIndex,
          }];
        },
      );
    });
}

/** PB収録曲と追加曲と外した曲を、曲名順に並べた全行 */
export function songRowsOf(
  ports: RowPorts,
  {
    editions,
    excluded,
    lengths,
    manifest,
    pbSongs,
    subtitles,
  }: SongListInput,
): SongRow[] {
  const bytesOf = bytesOfLengths(lengths);
  const sharedAbcIndex = manifest.sharedVideoAbcIndex ??
    ports.fallbackVideoAbcIndex;
  const abcIndices = ports.newAbcIndices(manifest);
  const pbOf = new Map(pbSongs.map((pb) => [pb.song.song_id, pb]));
  const variantFor = variantForOf(
    manifest.songs,
    new Map(pbSongs.map((pb) => [pb.song.song_id, pb.key])),
  );
  const pbSongmapSongs = pbSongs.map(({ song }) => song);
  // 裏エントリーは選曲リストに並ばないが、曲リストには表の曲を添えて載せる
  const added = manifest.songs.map((song, index): SortedRow => {
    const { shown } = song;
    // 全曲リストの`share`で共有する曲は、PB原盤の曲のオーバーレイを使う
    const shared = song.sharedWith === undefined
      ? undefined
      : pbOf.get(song.sharedWith.targetSongIndex);
    // 裏の曲は裏の中で移すだけの組を、表の曲は表の曲の行に書いた組(`chartMoves`)を、曲の中で移す
    const { fills, moves } = splitMoves(song.variantOf);
    const { charts, movedIn } = withMovedCharts(
      ownChartsOf(song),
      moves.length > 0 ? Object.fromEntries(moves) : song.chartMoves,
    );
    return {
      row: {
        ...songSize(
          song,
          abcIndices[index],
          shown.videoAbcIndex,
          sharedAbcIndex,
          bytesOf,
          sharedSoundsOf(pbSongmapSongs, song),
        ),
        // 表の曲へ写した譜面は、表の曲の難易度で演奏する
        charts: withLinkedCharts(
          charts,
          fills.map(([, from]) => from),
        ),
        ...(movedIn === undefined ? {} : { movedIn }),
        ...folderFieldsOf(ports.folderShort, shown.folder, shown),
        generation: song.sourceGeneration,
        inSelectList: song.variantOf === undefined,
        key: song.canonicalKey,
        note: song.note,
        original: false,
        ...(shared === undefined
          ? overlayOf(song.sourceGeneration, song.sourceOverlay, bytesOf)
          : overlayOf("pb", shared.overlay, bytesOf)),
        removed: false,
        // 裏エントリーは選曲できないので、セーブデータに記録が書かれない
        ...(song.variantOf === undefined
          ? { saveIndex: song.targetSongIndex }
          : {}),
        sharedWith: song.sharedWith?.targetSongIndex,
        songId: song.sourceSongIndex,
        sourceFolder: folderTextOf(
          ports.folderShort,
          ports.sourceFolderOf(song.sourceGeneration, song),
        ),
        title: song.title,
        variantFor: variantFor(song),
      },
      catalogKey: ports.catalogKeyOf(
        song.sourceGeneration,
        song.sourceSongIndex,
        song.catalogLine,
      ),
      sortKey: shown.sortKey,
    };
  });
  // PBのABC indexへ向けた曲は`pb:番号`、CSAが置く資産へ向けた曲は資産の`世代:番号`で出す
  const redirects = new Map(
    (manifest.pbVideoRedirects ?? []).map((redirect): [number, Video] => [
      redirect.songIndex,
      "abcIndex" in redirect ? pbVideo(redirect.abcIndex) : {
        id: ports.abcIndexOfAsset(manifest, redirect.asset),
        source:
          `${redirect.asset.sourceGeneration}:${redirect.asset.sourceFileIndex}`,
      },
    ]),
  );
  const pbRows = withPbBacks(
    pbRowsOf(ports, pbSongs, redirects, bytesOf),
    manifest.pbBacks ?? [],
    manifest.songs,
  );
  const ordered = withFrontsFirst(
    withFrontFills([
      ...pbRows.rows,
      ...added,
      ...excluded.map((song) =>
        excludedRowOf(ports, song, sharedAbcIndex, bytesOf)
      ),
    ], [...frontFillsOf(manifest.songs), ...pbRows.frontFills]).sort((a, b) =>
      compare(a.sortKey, b.sortKey) ||
      compare(a.row.key, b.row.key) ||
      compare(a.row.generation, b.row.generation)
    ).map(({ catalogKey, row }) => {
      const front = row.variantFor;
      // 裏の行は副題を持たない。副題はゲームの表の曲に付くからである
      const subtitle = front === undefined || front.rule === FIVE_KEYS
        ? subtitles.get(catalogKey)
        : undefined;
      const edition = editions.get(catalogKey);
      return {
        ...row,
        ...(subtitle === undefined ? {} : { subtitle }),
        ...(edition === undefined ? {} : { edition }),
      };
    }),
  );
  assertBackFolders(ordered);
  return ordered;
}
