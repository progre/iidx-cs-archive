// 1世代分の行を作る。曲ごとに素材と変換経路を集める。

import {
  type FiveKeyFront,
  isProgressStep,
  type ManifestSongDraft,
  type SongmapSong,
  type SongVariant,
  type SourceAsset,
} from "@csa/core";
import {
  type AnotherSwitches,
  type AssetContext,
  collectFields,
  distinctVideosOf,
  KIND_ORDER,
  rowAssetsOf,
  videoRoute,
} from "../assets/mod.ts";

// songmapの1曲を、資産ごとの入力と経路の行へ写す。経路の定義は paths.ts。
function fail(message: string): never {
  throw new Error(message);
}

export async function buildSongAssets(
  context: AssetContext,
  song: SongmapSong,
): Promise<SourceAsset[]> {
  const assets: SourceAsset[] = [];
  const distinct = { ...song, videos: await distinctVideosOf(context, song) };
  for (const kind of KIND_ORDER) {
    const fields = [...collectFields(distinct, kind).entries()].sort((a, b) =>
      a[0] - b[0]
    );
    for (const [index, names] of fields) {
      const file = context.files.get(index) ??
        fail(`${context.generation} song${song.song_id} file${index}が無い`);
      assets.push({
        fields: names,
        kind,
        ...(kind === "video"
          ? await videoRoute(context, song, file)
          : { path: "source" as const }),
        sourceArchive: file.archive,
        sourceFileIndex: index,
        sourceOffset: file.offset,
        sourceSize: file.size,
      });
    }
  }
  return assets;
}

/**
 * 全曲リストの行と、曲の組。`excluded`は`exclude`の列に何か書いた行である。
 * 組は、原作がELFに直書きしているものと全曲リストに書いたものを、app がまとめて渡す
 */
export interface Listing {
  /** 原作がANOTHERのときだけ別の素材を使う曲なら、その素材。曲ごとに同じ値である */
  another: AnotherSwitches | null;
  excluded: boolean;
  /** 収録しない譜面の難易度名 */
  excludedCharts: readonly string[];
  /** 5鍵盤版なら、表の曲 */
  fiveKeyOf: FiveKeyFront | null;
  /** 全曲リストの行番号。同じ曲を2行に書いた曲では、行ごとに違う */
  line: number;
  /** 行に書いた難易度。同じ曲を2行に書いた曲では、行ごとに違う */
  levels: Readonly<Record<string, number>>;
  /** 表の曲の行に書いた`front_charts`。表の曲の中で、右の難易度の譜面を左の難易度へ移す */
  movedCharts: Record<string, string> | null;
  note: string | null;
  /** 音とオーバーレイを共有するPB原盤の曲の管理名 */
  share: string | null;
  /** 裏エントリーなら、差し替え元の曲と条件 */
  variant: SongVariant | null;
}

/**
 * 全曲リストに行がある曲だけを行にする。ドリルのような内部の項目は全曲リストに書かないので、行にならない。
 * 譜面を持たない終端スロットは曲でないので飛ばす。
 * 題名が空白の曲(8thの3曲)はindex.jsonに載らないので、世代とsong_idで一意にする。
 * 全曲リストで同じ曲を2行に書いた曲は、行ごとに1行にする。2行目は別の曲の裏である
 */
export async function buildGenerationRows(
  context: AssetContext,
  songs: readonly SongmapSong[],
  indexKeyOf: (song: SongmapSong) => string,
  listingsOf: (songId: number) => readonly Listing[],
): Promise<ManifestSongDraft[]> {
  const { generation } = context;
  const rows: ManifestSongDraft[] = [];
  for (const [done, song] of songs.entries()) {
    if (isProgressStep(done + 1, songs.length)) {
      console.log(`${done + 1}/${songs.length} ${generation} song`);
    }
    const listings = listingsOf(song.song_id);
    if (listings.length === 0 || Object.keys(song.charts).length === 0) {
      continue;
    }
    const canonicalKey = indexKeyOf(song) ||
      `${generation}:${song.song_id}`;
    const sourceAssets = await buildSongAssets(context, song);
    const another = listings[0].another;
    const assetsOfRow = await rowAssetsOf(
      context,
      song,
      sourceAssets,
      another,
    );
    rows.push(...listings.map((listing): ManifestSongDraft => {
      const { fiveKeyOf, variant } = listing;
      return {
        sourceAssets: listing.excluded
          ? sourceAssets
          : assetsOfRow(listing.excludedCharts),
        ...(another?.titleCardSprite == null
          ? {}
          : { anotherTitleCardSprite: another.titleCardSprite }),
        ...(another?.overlayOnlyAnother ? { overlayOnlyAnother: true } : {}),
        canonicalKey,
        catalogLevels: { ...listing.levels },
        catalogLine: listing.line,
        ...(listing.excluded ? { excluded: true } : {}),
        ...(listing.excludedCharts.length === 0
          ? {}
          : { excludedCharts: [...listing.excludedCharts] }),
        ...(fiveKeyOf === null ? {} : { fiveKeyOf }),
        ...(listing.movedCharts === null
          ? {}
          : { movedCharts: listing.movedCharts }),
        sourceGeneration: generation,
        ...(listing.note === null ? {} : { note: listing.note }),
        ...(listing.share === null ? {} : { share: listing.share }),
        sourceSongIndex: song.song_id,
        title: song.title,
        ...(variant === null ? {} : { variantOf: variant }),
      };
    }));
  }
  return rows;
}
