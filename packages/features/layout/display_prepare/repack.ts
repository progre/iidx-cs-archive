// 9th以降の`.if`を周回でファイルに書くとき、書く本の選び出しと、置いたファイルへ差し替えた
// manifestの曲を決める。記述子が`+4`の世代(9th〜red・US)は、PBのloaderが読める`+8`形式へ並べ替える。
// 周回で書く`.if`の置き場と名前も決める。曲名カードを何件組んだかを、実行の記録の1行に書く。バイト列は扱わない。

import {
  type DescriptorStart,
  type DisplaySong,
  INTERMEDIATE_DIRECTORY,
  type ManifestOverlayPackage,
  type SourceSlice,
} from "@csa/core";

/** 素材の`.if`1本を並べ替える依頼 */
export interface RepackRequest {
  descriptorStart: DescriptorStart;
  fileIndex: number;
  generation: string;
  sourceOffset: number;
  sourceSize: number;
}

/** 世代 → 周回で`.if`に書く世代の記述子開始位置。曲名表示資産を持たない世代はnull */
export type DescriptorStartOf = (generation: string) => DescriptorStart | null;

/** 並べ替えた先のファイル */
export interface RepackedFile {
  /** manifestの`sourceArchive`へ入れる名 */
  archive: string;
  size: number;
}

export interface RepackSources {
  /** 素材世代のDATA1アーカイブ名 */
  dataArchive: string;
  descriptorStartOf: DescriptorStartOf;
}

function requestOf(
  generation: string,
  descriptorStart: DescriptorStart,
  item: SourceSlice,
): RepackRequest {
  return {
    descriptorStart,
    fileIndex: item.sourceFileIndex,
    generation,
    sourceOffset: item.sourceOffset,
    sourceSize: item.sourceSize,
  };
}

/** 曲名カードを`.if`に書く依頼。書かない曲はnull */
export function titleCardRepackRequest(
  song: DisplaySong,
  sources: RepackSources,
): RepackRequest | null {
  const card = song.titleCard;
  const generation = song.sourceGeneration;
  const descriptorStart = sources.descriptorStartOf(generation);
  if (card === undefined || descriptorStart === null) {
    return null;
  }
  if (card.sourceArchive !== sources.dataArchive) {
    throw new Error(`${song.title} の曲名カードが${card.sourceArchive}にある`);
  }
  return requestOf(generation, descriptorStart, card);
}

export function withRepackedTitleCard<S extends DisplaySong>(
  song: S,
  file: RepackedFile,
): S {
  return {
    ...song,
    titleCard: {
      ...song.titleCard!,
      sourceArchive: file.archive,
      sourceOffset: 0,
      sourceSize: file.size,
    },
  };
}

/** 曲中オーバーレイの各パッケージを`.if`に書く依頼。書かない曲はnull */
export function overlayRepackRequests(
  song: DisplaySong,
  sources: RepackSources,
): RepackRequest[] | null {
  const generation = song.sourceGeneration;
  const descriptorStart = sources.descriptorStartOf(generation);
  if (song.overlay === undefined || descriptorStart === null) {
    return null;
  }
  return song.overlay.packages.map((item) => {
    if (item.sourceArchive !== sources.dataArchive) {
      throw new Error(
        `${generation} のオーバーレイが${item.sourceArchive}にある`,
      );
    }
    return requestOf(generation, descriptorStart, item);
  });
}

/** `files`は`overlayRepackRequests`が返した依頼と同じ並び */
export function withRepackedOverlay<S extends DisplaySong>(
  song: S,
  files: readonly RepackedFile[],
): S {
  const packages: ManifestOverlayPackage[] = song.overlay!.packages.map((
    item,
    at,
  ) => ({
    ...item,
    sourceArchive: files[at].archive,
    sourceOffset: 0,
    sourceSize: files[at].size,
  }));
  return { ...song, overlay: { ...song.overlay!, packages } };
}

/** 世代のフォルダーの下で、`.if`を種類ごとに置くフォルダーの名前 */
export type IfFolder = "overlays" | "title_cards";

/** 周回で書く`.if`の置き場。`discsDirectory`は、周回の成果物を世代ごとに置く場所 */
export const ifDirectoryOf = (
  discsDirectory: string,
  generation: string,
  folder: IfFolder,
): string => `${discsDirectory}/${generation}/${folder}`;

/** `.if`の連番を4桁に揃えた名前 */
export const ifFileNameOf = (fileIndex: number): string =>
  String(fileIndex).padStart(4, "0");

export const ifFilePathOf = (directory: string, name: string): string =>
  `${directory}/${name}.if`;

/** 周回の成果物は、中間フォルダーの下にだけ置く */
export function assertIntermediateDirectory(discsDirectory: string): void {
  if (!discsDirectory.startsWith(`${INTERMEDIATE_DIRECTORY}/`)) {
    throw new Error(`${discsDirectory}は${INTERMEDIATE_DIRECTORY}/以下へ置く`);
  }
}

/** 実行の記録に書く、曲名カードの件数 */
export interface TitleCardSummary {
  /** 曲名カード欄がカードを指していないので、カードを組まなかった曲 */
  skipped: readonly string[];
  /** 記述子の並べ替えで置いた本数 */
  repacked: number;
  /** この回に書いたファイルを使った本数 */
  reused: number;
  root: string;
  /** legacyから組んだ本数 */
  written: number;
}

export const titleCardSummary = (summary: TitleCardSummary): string =>
  `title cards: repacked ${summary.repacked} / reused ${summary.reused} / ` +
  `legacy generated ${summary.written} -> ${summary.root}` +
  (summary.skipped.length === 0
    ? ""
    : `\nsongs without legacy cards ${summary.skipped.length}: ` +
      summary.skipped.join(", "));

/** 実行の記録に書く、周回で書いて使わなかった`.if`の件数の行 */
export const unusedIfLine = (count: number): string =>
  `unused .if written in laps: ${count}`;
