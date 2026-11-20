// 行の欄のうち、どの種類の曲の行でも同じ決め方をするもの。難易度・オーバーレイ・フォルダーの欄である。

import type { ChartPrint, ListEntry, SongOverlay } from "@csa/core";
import type { RowPorts } from "../../ports.ts";
import type { Chart, MovedInChart, SongRow } from "../../types.ts";
import { DIFFICULTY_NAMES } from "../columns.ts";
import type { BytesOf } from "../sizes.ts";

// オーバーレイのパッケージを、世代をまたいで見分ける識別子。

/** 番号の空間が世代ごとに別なので、識別子には世代名を付ける */
const overlayPackageId = (generation: string, serial: number): string =>
  `${generation}:${serial}`;

/** 音の長さとハッシュを引くときの識別子 */
export const soundSourceOf = (generation: string, fileIndex: number): string =>
  `${generation}:${fileIndex}`;

/** 長さを引くときの識別子。音の`世代:file index`と番号がぶつかるので、印を付けて分ける */
export const overlaySourceOf = (generation: string, serial: number): string =>
  "if:" + overlayPackageId(generation, serial);

type FolderShort = RowPorts["folderShort"];

/** 曲名順に並べるための並びキーを添えた行 */
export interface SortedRow {
  /** 全曲リストから副題とエディションを引くキー(`catalogKeyOf`) */
  catalogKey: string;
  row: SongRow;
  sortKey: string;
}

/** `excluded`は全曲リストで`x`を書いた譜面の難易度名 */
const chartOf = (
  entry: ListEntry,
  prints: Readonly<Record<string, ChartPrint>>,
  name: string,
  excluded: readonly string[],
): Chart => {
  const before = entry.uncorrected?.levels?.[name];
  const print = prints[name];
  return {
    ...(before === undefined ? {} : { before }),
    ...(excluded.includes(name) ? { excluded: true } : {}),
    level: entry.levels[name],
    notes: entry.notes[name],
    ...(print === undefined ? {} : { print }),
  };
};

/** `hasChart`を満たす難易度だけを、列の順で並べる */
export const chartsOf = (
  entry: ListEntry,
  prints: Readonly<Record<string, ChartPrint>>,
  hasChart: (name: string) => boolean,
  excluded: readonly string[] = [],
): SongRow["charts"] =>
  Object.fromEntries(
    DIFFICULTY_NAMES
      .filter(hasChart)
      .map((name) => [name, chartOf(entry, prints, name, excluded)]),
  );

/** `names`の難易度の譜面に、ほかの欄へ移した印を付ける */
/** 裏の曲の`chartMoves`のうち、表の曲にも写す組(`frontFills`)と、裏の中で移すだけの組 */
export function splitMoves(
  variant:
    | { chartMoves?: Record<string, string>; frontFills?: string[] }
    | undefined,
): { fills: [string, string][]; moves: [string, string][] } {
  const pairs = Object.entries(variant?.chartMoves ?? {});
  const isFill = ([to]: [string, string]) =>
    variant?.frontFills?.includes(to) === true;
  return {
    fills: pairs.filter(isFill),
    moves: pairs.filter((pair) => !isFill(pair)),
  };
}

export function withLinkedCharts(
  charts: SongRow["charts"],
  names: readonly string[],
): SongRow["charts"] {
  return Object.fromEntries(
    Object.entries(charts).map(([name, chart]) => [
      name,
      names.includes(name) ? { ...chart, linked: true } : chart,
    ]),
  );
}

/** 同じ欄に2つの譜面を入れると、片方が表から消える。そうなるデータは誤りなので、例外にする */
export function movedInWith(
  movedIn: Readonly<Record<string, MovedInChart>> | undefined,
  to: string,
  chart: MovedInChart,
): Record<string, MovedInChart> {
  if (movedIn?.[to] !== undefined) {
    throw new Error(`${to}の欄に、ほかの欄から2つの譜面が入る`);
  }
  return { ...movedIn, [to]: chart };
}

/**
 * 曲の中で移した譜面(`chartMoves`)を、移し先の難易度の欄へ入れる。
 * 移し元の譜面には移した印を付ける。移し先が自前で持つ譜面は、そのまま残す
 */
export function withMovedCharts(
  charts: SongRow["charts"],
  moved: Readonly<Record<string, string>> = {},
): Pick<SongRow, "charts" | "movedIn"> {
  const movedIn = Object.entries(moved)
    .filter(([, from]) => charts[from] !== undefined)
    .reduce<Record<string, MovedInChart> | undefined>(
      (sum, [to, from]) =>
        movedInWith(sum, to, { ...charts[from], from: { chart: from } }),
      undefined,
    );
  return {
    charts: withLinkedCharts(charts, Object.values(moved)),
    ...(movedIn === undefined ? {} : { movedIn }),
  };
}

/** 表の曲が持たず、裏の曲で出す譜面(`chart_moves`)。`saveIndex`は表の曲の枠 */
export interface FrontFill {
  chart: MovedInChart;
  /** 表の曲の難易度名 */
  name: string;
  saveIndex: number;
}

/**
 * 表の曲の行に、裏の曲で出す譜面を足す。実機の曲DBでも、裏の曲の欄を表の曲へ写してある
 */
export function withFrontFills(
  rows: readonly SortedRow[],
  fronts: readonly FrontFill[],
): SortedRow[] {
  const bySaveIndex = Map.groupBy(fronts, (front) => front.saveIndex);
  return rows.map((sorted) => {
    const saveIndex = sorted.row.saveIndex;
    const added = saveIndex === undefined
      ? undefined
      : bySaveIndex.get(saveIndex);
    if (added === undefined) {
      return sorted;
    }
    const movedIn = added.reduce(
      (sum, { chart, name }) => movedInWith(sum, name, chart),
      sorted.row.movedIn,
    );
    return { ...sorted, row: { ...sorted.row, movedIn } };
  });
}

/** 外した譜面は譜面のファイルを指さない。そのため、ノーツ数が1以上なら譜面があると判断する */
export const hasNotes = (entry: ListEntry) => (name: string): boolean =>
  entry.notes[name] > 0;

/** オーバーレイのパッケージが1つも無い曲は、枚数が残っていても量を空にする */
export const overlayOf = (
  generation: string,
  { packages, sheets }: SongOverlay,
  bytesOf: BytesOf,
): Pick<SongRow, "overlayPackages" | "overlaySheets"> =>
  packages.length === 0 ? { overlayPackages: [], overlaySheets: 0 } : {
    overlayPackages: packages.map((serial) => ({
      bytes: bytesOf(overlaySourceOf(generation, serial)),
      id: overlayPackageId(generation, serial),
    })),
    overlaySheets: sheets,
  };

/** 原作フォルダーは枠なら略号、新旧の印ならその文字をそのまま出す */
export const folderTextOf = (
  folderShort: FolderShort,
  folder: number | string | undefined,
): string | undefined =>
  typeof folder === "number" ? folderShort(folder) : folder;

/** 収録フォルダーの欄。`entry`の補正前の枠があれば、それも出す */
export function folderFieldsOf(
  folderShort: FolderShort,
  folder: number,
  entry: ListEntry,
): Pick<SongRow, "folder" | "folderBefore" | "folderOrder"> {
  const before = entry.uncorrected?.folder;
  return {
    folder: folderShort(folder),
    ...(before === undefined
      ? {}
      : { folderBefore: before === null ? null : folderShort(before) }),
    folderOrder: folder,
  };
}
