// データをテンプレートがそのまま並べられる形へ直す。計算と整形はここで済ませ、
// テンプレートには分岐と繰り返しだけを残す。

import {
  ASSET_GROUPS,
  type HeaderGroup,
  SONG_GROUP,
  SOUND_PRINT_COLUMNS,
} from "./headers.ts";
import { type SaveOrderRow, saveOrderRows } from "../save_order/mod.ts";
import type { Difficulty, SongListData, SongRow } from "../types.ts";
import {
  bytesText,
  type ChartView,
  chartView,
  fiveKeysIdsOf,
  folderText,
  keyText,
  movieText,
  rowClassOf,
  variantLines,
} from "./cells/mod.ts";
import { type RefsView, refsView, soundPrintLines } from "./refs.ts";
import { overlaySharing, videoSharing } from "./sharing.ts";
import { summaryOf, type SummaryView } from "./summary.ts";

export interface RowView {
  /** 行に付ける区分。CSAから外した曲と、裏エントリー・5鍵盤版を見分ける */
  classes: string;
  folder: string;
  folderOrder: number;
  /** 収録フォルダーの欄。`folder`列で変えたなら`規則→補正` */
  folderText: string;
  generation: string;
  key: string;
  /** 難易度の列と同じ並び */
  levels: ChartView[];
  /** 全曲リストの`note` */
  note: string | null;
  /** 値が空の欄はテンプレートが`—`を出すので、0とnullを分けない */
  overlay: string | null;
  overlayRefs: RefsView | null;
  overlaySheets: number | null;
  sound: string | null;
  /** 音のハッシュの欄。`SOUND_PRINT_COLUMNS`の順で、欄の中はファイルごとに1行 */
  soundPrints: string[][];
  sourceFolder: string | null;
  title: string;
  /** 裏エントリーと5鍵盤版の欄。`条件 for:`と表の曲の管理名と、選ぶボタン */
  variant: string[] | null;
  /** 裏エントリーの欄は幅で切り詰めるので、全文をツールチップに表示する */
  variantTitle: string | null;
  video: string | null;
  videoRefs: RefsView | null;
}

export interface HeadView {
  count: number;
  folder: string;
  order: number;
}

export interface PageView {
  assetGroups: HeaderGroup[];
  difficulties: Difficulty[];
  heads: HeadView[];
  label: string;
  removedCount: number;
  rows: RowView[];
  saveOrder: SaveOrderRow[];
  /** 実機の選曲リストに並ぶ曲の数 */
  selectCount: number;
  script: string;
  songGroup: HeaderGroup;
  style: string;
  summary: SummaryView;
}

const sizeView = (bytes: number): string | null =>
  bytes === 0 ? null : bytesText(bytes);

/**
 * フォルダーごとのタブ。曲が無い枠は出さない。
 * 曲数は、実機の選曲リストでその枠に並ぶ曲の数である。裏エントリーは数えない
 */
function headViews(songs: readonly SongRow[]): HeadView[] {
  const counts = new Map<number, HeadView>();
  for (const song of songs) {
    const found = counts.get(song.folderOrder);
    counts.set(song.folderOrder, {
      count: (found?.count ?? 0) + (song.inSelectList ? 1 : 0),
      folder: song.folder,
      order: song.folderOrder,
    });
  }
  return [...counts.values()].sort((a, b) => a.order - b.order);
}

export function pageView(
  data: SongListData,
  style: string,
  script: string,
): PageView {
  // 外した曲はCSAに載らないので、数・共有・総量に含めない
  const listed = data.songs.filter((song) => !song.removed);
  const videos = videoSharing(listed);
  const overlays = overlaySharing(listed);
  const fiveKeysIds = fiveKeysIdsOf(data.songs);
  const labelOf = (name: string) =>
    data.difficulties.find((each) => each.name === name)?.label ?? name;
  const rows = data.songs.map((song): RowView => ({
    classes: rowClassOf(song, fiveKeysIds),
    folder: song.folder,
    folderOrder: song.folderOrder,
    folderText: folderText(song),
    generation: song.generation,
    key: keyText(song),
    levels: data.difficulties.map((difficulty) =>
      chartView(song, difficulty.name, labelOf)
    ),
    note: song.note ?? null,
    overlay: sizeView(
      song.overlayPackages.reduce((sum, each) => sum + each.bytes, 0),
    ),
    overlayRefs: refsView(
      song.overlayPackages.map((each) => ({ key: each.id, label: each.id })),
      overlays,
    ),
    overlaySheets: song.overlaySheets === 0 ? null : song.overlaySheets,
    sound: sizeView(song.soundBytes),
    soundPrints: SOUND_PRINT_COLUMNS.map(([kind, part]) =>
      soundPrintLines(song.sounds, data.soundPrints, kind, part)
    ),
    sourceFolder: song.sourceFolder ?? null,
    title: song.subtitle === undefined
      ? song.title
      : `${song.title} ${song.subtitle}`,
    variant: variantLines(song),
    variantTitle: variantLines(song)?.join(" ") ?? null,
    video: sizeView(song.videoBytes),
    videoRefs: refsView(
      song.videos.map((video) => ({
        key: video.source,
        label: movieText(
          [video.original, video.source, video.id]
            .filter((part) => part !== undefined)
            .join(" → "),
          data.movieAliases,
        ),
      })),
      videos,
    ),
  }));
  return {
    assetGroups: ASSET_GROUPS,
    difficulties: data.difficulties,
    heads: headViews(listed),
    label: data.label,
    removedCount: data.songs.length - listed.length,
    rows,
    saveOrder: saveOrderRows(data.songs),
    script,
    selectCount: listed.filter((song) => song.inSelectList).length,
    songGroup: SONG_GROUP,
    style,
    summary: summaryOf(listed),
  };
}
