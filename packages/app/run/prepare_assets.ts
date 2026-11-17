// 素材を整えてmanifestを仕上げる呼び出し順。世代ごとの変換の中身は各パッケージが担う。
// era1の譜面は、`entry_id`の対応表で書き換える。この対応表は、キー音bundleを作る処理が返す。そのため、音声の変換を先に行う。

import type { PbSong } from "@csa/report-song-list";
import {
  type PreparedPackedCharts,
  preparePackedCharts,
} from "../ports/media/mod.ts";
import { hasDisplayAssets } from "@csa/contents-display";
import type { IndividualAssetManifest, SoundPrint } from "@csa/core";
import { writeKeptBundle } from "@csa/contents-sound";
import {
  copiedVideoLine,
  type CopyLap,
  placeCopiedVideos,
} from "@csa/contents-video";
import {
  prepareDisplayAfterLaps,
  unusedFiles,
  unusedIfLine,
} from "@csa/layout-display-prepare";
import { prepareSoundBundles, type SoundLap } from "@csa/layout-sound-bundle";
import { DISCS_DIRECTORY } from "@csa/selection-manifest";
import type { LapSources } from "../laps/mod.ts";
import type { DisplayLap } from "../ports/display/mod.ts";
import type { DiscInfo, PbSource } from "@csa/containers-disc";
import type { CatalogRow } from "@csa/selection-song-catalog";

// 世代の周回が、ISOを作る側へ渡すもの。
export interface LapInputs {
  /** 世代 → 原盤のファイル一覧と大きさ */
  discs: ReadonlyMap<string, DiscInfo>;
  /** 開いたままのPBの原盤。ここでは閉じず、渡した側が閉じる */
  pb: PbSource;
  /** PB原盤の曲。曲リストに載せる */
  pbSongs: readonly PbSong[];
  /** 世代 → 周回で書いた曲名カードとオーバーレイの`.if` */
  displayLaps: ReadonlyMap<string, DisplayLap>;
  /** 世代 → 周回で書いた音のbundle */
  soundLaps: ReadonlyMap<string, SoundLap>;
  /** 素材側の識別子 → 周回で原盤から数えた、音とオーバーレイの末尾のゼロを除いた長さ。PBの分は、オーバーレイの長さだけを持つ */
  sourceLengths: ReadonlyMap<string, number>;
  /** 素材側の識別子 → 周回で原盤から求めた、世代の音の本体とヘッダーのハッシュ。PBの分は持たない */
  soundPrints: ReadonlyMap<string, SoundPrint>;
  /** `overlaySourceOf`の識別子 → 周回で原盤から求めた、オーバーレイの中身のハッシュ。PBの分も持つ */
  contentPrints: ReadonlyMap<string, string>;
  /** 世代 → 周回で書いた、そのまま写す映像 */
  copyLaps: ReadonlyMap<string, CopyLap>;
  songs: {
    /** 周回で読んだ全曲リスト。世代 → 曲番号 → 行。曲リストに副題を出すのに使う */
    catalogRows: ReadonlyMap<string, ReadonlyMap<number, CatalogRow>>;
    /** 周回で読んだ素材 */
    sources: LapSources;
  };
}

export interface PreparedAssets<
  M extends IndividualAssetManifest = IndividualAssetManifest,
> {
  /** 変換して置いた音声のsource key → path */
  bundles: Map<string, string>;
  manifest: M;
  /** 世代の譜面bundleを、読むたびにPB鍵で暗号化する`DiscImage`として返す */
  openChartImage: PreparedPackedCharts["openImage"];
  /** 各処理の要約。実行の記録へそのまま並べる */
  summaries: string[];
}

export function prepareAssets<M extends IndividualAssetManifest>(
  sourceManifest: M,
  { copyLaps, displayLaps, songs: { sources }, soundLaps }: LapInputs,
): PreparedAssets<M> {
  const sound = prepareSoundBundles(
    writeKeptBundle,
    sourceManifest,
    DISCS_DIRECTORY,
    soundLaps,
  );
  const charts = preparePackedCharts(
    sound.manifest,
    sound.soundMaps,
    sources,
  );
  // 原盤を指す映像を、周回で書いたファイルへ向ける。
  // 使わないファイルも消さない。次のビルドで選ばれたときに、写し直さずに使う
  const copies = placeCopiedVideos(charts.manifest, copyLaps);
  // 曲名カードとオーバーレイは、周回で整えたものを当てはめる。原盤は開かない
  const display = prepareDisplayAfterLaps(
    hasDisplayAssets,
    copies.manifest,
    displayLaps.values(),
    DISCS_DIRECTORY,
  );
  // 周回では収録の候補をすべて書くので、選外になった曲の`.if`が残る。
  // 次のビルドの周回が使い回すので、消さずに数だけを出す
  const unused = unusedFiles(displayLaps.values(), display.files);
  return {
    bundles: sound.bundles,
    manifest: display.manifest,
    openChartImage: charts.openImage,
    summaries: [
      sound.summary,
      charts.era1Summary,
      charts.summary,
      copiedVideoLine(copies.used, copies.unused.length),
      ...display.summaries,
      unusedIfLine(unused.length),
    ],
  };
}
