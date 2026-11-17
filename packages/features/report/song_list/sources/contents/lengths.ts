// 曲リストに出す音・ムービー・オーバーレイの中身の長さを、素材側の識別子ごとに求める。
// 音とムービーは末尾のゼロを除いた長さ、オーバーレイは`.if`の記述子が示す長さである。
// 曲リストは、この長さを容量として出す。中身が同じファイルは、世代が違っても同じ値になる。
// ムービーは、長さまでの中身からハッシュも求める。曲リストは、これで同じムービーかどうかを見分ける。
// 長さを数えるときは、各ファイルの末尾を読む。ハッシュを求めるムービーは、全体を読む。
// ムービーの長さとハッシュは、前のビルドの記録に同じキーがあれば、読まずに記録の値を使う。
// - 音とオーバーレイは、周回で原盤から数えた長さを受け取る
// - 変換したムービーと写したムービーは、中間ファイルから読む
// - PBの音とムービーは、開いたままのPBの原盤から読む

import {
  assetGenerationOf,
  type ExcludedSong,
  type IndividualAssetManifest,
  type ManifestAsset,
  type ManifestSong,
  parseGeneratedSource,
  SEC,
  type SongmapDoc,
} from "@csa/core";
import type { PbDisc } from "../lap/mod.ts";
import type { SongListWritePorts } from "../../ports.ts";
import { fileStampOf, type MoviePrints } from "./movie_prints_gateway.ts";

type Ports = Pick<
  SongListWritePorts<unknown>,
  | "contentLength"
  | "copyPathOf"
  | "discsDirectory"
  | "entryVideoAbcIndex"
  | "printOf"
  | "readFileAt"
>;

type Song = Pick<ManifestSong, "assets" | "sourceGeneration">;

const archiveKey = (archive: string) => archive.toUpperCase().split(";")[0];

/** 資産のムービーのファイル。変換したものは単体ファイル、写したものは中間ファイルにある */
function assetFileOf(ports: Ports, song: Song, asset: ManifestAsset) {
  const generated = parseGeneratedSource(asset.sourceArchive);
  const path = generated?.kind === "file" ? generated.name : ports.copyPathOf(
    ports.discsDirectory,
    assetGenerationOf(song, asset),
    asset,
  );
  const base = generated?.kind === "file" ? asset.sourceOffset : 0;
  return {
    /** 記録を引くキー。ファイルを書き直せば変わる */
    key: `${path}@${base}+${asset.sourceSize}#${fileStampOf(path)}`,
    read: (offset: number, length: number) =>
      ports.readFileAt(path, base + offset, length),
  };
}

/** 自前のムービーを持たない曲が再生する、PBのムービーのABC index */
function borrowedPbIndex(
  ports: Ports,
  song: ManifestSong,
  sharedAbcIndex: number,
): number | undefined {
  if (song.assets.some((asset) => asset.kind === "video")) {
    return undefined;
  }
  return song.videoFields.length > 0
    ? sharedAbcIndex
    : ports.entryVideoAbcIndex(song.entry);
}

/** PBの曲が鳴らす音のABC index */
const pbSoundIndices = (pbSongmap: SongmapDoc) =>
  pbSongmap.songs
    .flatMap((song) => song.sounds)
    .flatMap((pair) => [pair.keysound, pair.bgm])
    .filter((index) => index !== null);

type Read = (offset: number, length: number) => Promise<Uint8Array>;

/** 素材側の識別子 → 中身の長さと、ムービーの中身のハッシュ */
export interface Contents {
  lengths: Map<string, number>;
  prints: Map<string, string>;
}

/** 長さを数える */
async function measure(
  ports: Ports,
  contents: Contents,
  source: string,
  size: number,
  read: Read,
): Promise<void> {
  contents.lengths.set(source, await ports.contentLength(size, read));
}

/**
 * ムービーの長さと、長さまでの中身のハッシュを求める。
 * ムービーは全体を読むので時間がかかる。`saved`にキーがあれば、読まずに記録の値を使う
 */
async function measureMovie(
  ports: Ports,
  contents: Contents,
  source: string,
  size: number,
  { key, read }: { key: string; read: Read },
  saved: MoviePrints,
): Promise<void> {
  const found = saved.get(key) ?? await (async () => {
    const length = await ports.contentLength(size, read);
    const measured = {
      length,
      print: await ports.printOf(await read(0, length)),
    };
    saved.set(key, measured);
    return measured;
  })();
  contents.lengths.set(source, found.length);
  contents.prints.set(source, found.print);
}

export async function contentLengthsOf(
  ports: Ports,
  manifest: IndividualAssetManifest,
  excluded: readonly ExcludedSong[],
  sourceLengths: ReadonlyMap<string, number>,
  pbSongmap: SongmapDoc,
  pbDisc: PbDisc,
  sharedAbcIndex: number,
  saved: MoviePrints,
): Promise<Contents> {
  const contents = { lengths: new Map(sourceLengths), prints: new Map() };
  const assetSongs: readonly Song[] = [...manifest.songs, ...excluded];
  for (const song of assetSongs) {
    for (const asset of song.assets.filter(({ kind }) => kind === "video")) {
      const source = `${
        assetGenerationOf(song, asset)
      }:${asset.sourceFileIndex}`;
      if (!contents.lengths.has(source)) {
        await measureMovie(
          ports,
          contents,
          source,
          asset.sourceSize,
          assetFileOf(ports, song, asset),
          saved,
        );
      }
    }
  }
  const pbVideos = new Set([
    ...pbSongmap.songs.flatMap((song) => song.videos),
    ...manifest.songs.flatMap((song) => {
      const index = borrowedPbIndex(ports, song, sharedAbcIndex);
      return index === undefined ? [] : [index];
    }),
  ]);
  const pbIndices = new Set([...pbVideos, ...pbSoundIndices(pbSongmap)]);
  const fileOf = new Map(pbSongmap.files.map((file) => [file.index, file]));
  for (const index of pbIndices) {
    const file = fileOf.get(index);
    const archive = file && pbDisc.info.files.get(archiveKey(file.archive));
    if (file === undefined || archive === undefined) {
      throw new Error(`PBのファイル一覧にABC index ${index}が無い`);
    }
    const start = archive.lba * SEC + file.offset;
    const read = (offset: number, length: number) =>
      pbDisc.readAt(start + offset, length);
    // PBの原盤は変わらないので、キーは原盤の中の場所と大きさだけで決まる
    await (pbVideos.has(index)
      ? measureMovie(
        ports,
        contents,
        `pb:${index}`,
        file.size,
        { key: `pb@${start}+${file.size}`, read },
        saved,
      )
      : measure(ports, contents, `pb:${index}`, file.size, read));
  }
  return contents;
}
