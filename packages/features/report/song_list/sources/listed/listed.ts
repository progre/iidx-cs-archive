// 収録する曲を、曲リストのデータを組む入力にする。曲DBエントリは、配置器が書く姿で読む。

import type { FinishedSong, ListEntry, ListUncorrected } from "@csa/core";
import type { ChartPrintsOf, SongListWritePorts } from "../../ports.ts";

type Ports = Pick<
  SongListWritePorts<unknown>,
  | "applyFiveKeyFields"
  | "decodeEntry"
  | "difficultyNameOfChartField"
  | "listEntryOf"
  | "versionFolder"
>;

const chartAssetsOf = (song: FinishedSong) =>
  song.assets.filter((asset) => asset.kind === "chart");

/** 5鍵盤版の表の曲。PB原盤の曲は manifest に無いので、エントリーだけを持つ */
type FiveKeyFront = Pick<FinishedSong, "uncorrected"> & { entry: Uint8Array };

/** 曲リストのデータを組む入力。`pbEntries`は、PBの曲index → 作品番号を直した後のエントリー */
export interface ListedSources {
  pbEntries: ReadonlyMap<number, Uint8Array>;
  songs: readonly FinishedSong[];
}

/**
 * 5鍵盤版の表の曲を返す。5鍵盤版でない曲にはundefinedを返す。
 * 5鍵盤版のレベル・作品番号・OTHERSの印は、配置器が表の曲の値を写す。
 * 全曲リストの`front_rule`に`five_keys`と書いた5鍵盤版は、`ownLevels`を持つ。
 * この5鍵盤版には、表の曲のレベルを写さない
 */
function fiveKeyFrontOf(
  ports: Ports,
  { pbEntries, songs }: ListedSources,
  song: FinishedSong,
): FiveKeyFront | undefined {
  const index = song.fiveKeyOf?.targetSongIndex;
  if (index === undefined) {
    return undefined;
  }
  const front = songs.find((other) => other.targetSongIndex === index);
  if (front !== undefined) {
    return { ...front, entry: ports.decodeEntry(front.entry) };
  }
  const pbEntry = pbEntries.get(index);
  if (pbEntry === undefined) {
    throw new Error(`5鍵盤版の表が無い: ${index}`);
  }
  return { entry: pbEntry };
}

/** 補正前の値。5鍵盤版のレベルは表の曲の値を写すので、補正前の値も表の曲から採る */
function uncorrectedOf(
  ports: Ports,
  song: FinishedSong,
  front: FiveKeyFront | undefined,
): ListUncorrected | undefined {
  const { version } = song.uncorrected ?? {};
  const levels = (song.fiveKeyOf?.ownLevels ? song : front ?? song).uncorrected
    ?.levels;
  if (version === undefined && levels === undefined) {
    return undefined;
  }
  return {
    ...(version === undefined
      ? {}
      : { folder: version === null ? null : ports.versionFolder(version) }),
    ...(levels === undefined ? {} : { levels }),
  };
}

/** 配置器が書く姿の曲DBエントリを読む。5鍵盤版は、表の曲の値で上書きした後の値を出す */
function shownOf(
  ports: Ports,
  sources: ListedSources,
  song: FinishedSong,
): ListEntry {
  const entry = ports.decodeEntry(song.entry);
  const front = fiveKeyFrontOf(ports, sources, song);
  const shown = front === undefined ? entry : ports.applyFiveKeyFields(
    {
      abcReferences: chartAssetsOf(song).flatMap((asset) => asset.references),
      entry,
    },
    front.entry,
    song.fiveKeyOf?.ownLevels === true,
  );
  const uncorrected = uncorrectedOf(ports, song, front);
  return {
    ...ports.listEntryOf(shown),
    ...(uncorrected === undefined ? {} : { uncorrected }),
  };
}

export const listedSongOf = (
  ports: Ports,
  sources: ListedSources,
  song: FinishedSong,
  chartPrintsOf: ChartPrintsOf,
) => ({
  ...song,
  chartNames: chartAssetsOf(song).map((asset) =>
    ports.difficultyNameOfChartField(asset.references[0].fieldOffset)
  ),
  chartPrints: chartPrintsOf(song.sourceGeneration, song.sourceSongIndex),
  shown: shownOf(ports, sources, song),
});
