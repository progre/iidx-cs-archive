// 原作のプログラムが曲番号を比べて、ANOTHERのときだけ別の素材を使う曲の扱い。
// 曲と素材の指定は`data/another_switches.csv`にあり、appが全曲リストの行の指定として渡す。
// オーバーレイと曲名カードは、PBで演奏中に難易度を見て切り替えるので、ここでは扱わない。
// ムービーは、PBで演奏中に切り替えられない。
// そこで、全曲リストの各行で収録する譜面の難易度から、ムービーを決める。

import type { SongmapSong, SourceAsset } from "@csa/core";
import type { AssetContext } from "./types.ts";
import { videoRoute } from "./video.ts";

/** ANOTHERとほかの難易度とで使い分ける素材 */
export interface AnotherSwitches {
  /** オーバーレイをANOTHERのときだけ使う */
  overlayOnlyAnother: boolean;
  /** ANOTHERで出す曲名カードの絵の番号。指定が無ければ`null` */
  titleCardSprite: number | null;
  /** ANOTHERで流すムービーの、songmapのファイルの通し番号。指定が無ければ`null` */
  video: number | null;
}

function fail(message: string): never {
  throw new Error(message);
}

/** 行に残る譜面の難易度。ANOTHERとほかの難易度が混ざれば`mixed`になる */
function chartGroupOf(
  song: SongmapSong,
  excludedCharts: readonly string[],
): "another" | "mixed" | "others" {
  const kept = Object.keys(song.charts)
    .filter((name) => !excludedCharts.includes(name));
  const another = kept.filter((name) => name.endsWith("_another"));
  if (another.length === 0) {
    return "others";
  }
  return another.length === kept.length ? "another" : "mixed";
}

async function anotherVideoAssets(
  context: AssetContext,
  song: SongmapSong,
  assets: SourceAsset[],
  index: number,
): Promise<SourceAsset[]> {
  const file = context.files.get(index) ??
    fail(`${context.generation} song${song.song_id} file${index}が無い`);
  const route = await videoRoute(context, song, file);
  return assets.map((asset) =>
    asset.kind !== "video" ? asset : {
      fields: asset.fields,
      kind: asset.kind,
      ...route,
      sourceArchive: file.archive,
      sourceFileIndex: index,
      sourceOffset: file.offset,
      sourceSize: file.size,
    }
  );
}

/**
 * 全曲リストの行で外した譜面から、その行の素材を決める関数を返す。
 * ANOTHERでムービーを切り替えない曲は、どの行も`assets`をそのまま使う。
 * 切り替える曲で、ANOTHERとほかの難易度が混ざる行は、1つの曲DBエントリーで表せないので止める
 */
export async function rowAssetsOf(
  context: AssetContext,
  song: SongmapSong,
  assets: SourceAsset[],
  another: AnotherSwitches | null,
): Promise<(excludedCharts: readonly string[]) => SourceAsset[]> {
  if (another === null || another.video === null) {
    return () => assets;
  }
  const anotherAssets = await anotherVideoAssets(
    context,
    song,
    assets,
    another.video,
  );
  return (excludedCharts) => {
    const group = chartGroupOf(song, excludedCharts);
    if (group === "mixed") {
      fail(
        `${context.generation} song${song.song_id}: ANOTHERで流すムービーが違う譜面が、全曲リストの1行にある`,
      );
    }
    return group === "another" ? anotherAssets : assets;
  };
}
