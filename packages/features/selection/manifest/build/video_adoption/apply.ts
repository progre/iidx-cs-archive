// 同じ内容のムービーを使う曲に、採用した1本を使わせる。
// 採用した版の曲がCSAに載るなら、その資産を置く。
// 採用した版の曲がPBにしか無いなら、PBのABC indexを書く。

import type {
  AdoptionPorts,
  AdoptionSources,
  SongId,
  VideoAdoption,
} from "../adoption/mod.ts";
import {
  assetGenerationOf,
  type ManifestAsset,
  type ManifestSong,
} from "@csa/core";
import {
  type Adopted,
  adoptedInCsa,
  adoptedInPb,
  FLAG_BITS,
  keyOf,
} from "./adopted.ts";

const PB = "pb";

function fail(message: string): never {
  throw new Error(message);
}

const nameOf = (song: ManifestSong) =>
  `${song.sourceGeneration}/${song.sourceSongIndex}`;

/** 曲DB`+0x62`のムービーの印。差し替えで書き換えるbitだけを返す */
const videoFlagsOf = (song: ManifestSong, ports: AdoptionPorts) =>
  ports.videoFlagsOfEntry(song.entry) & FLAG_BITS;

/**
 * 差し替えるムービーの資産。`slot`本目のフィールドを参照する1本があれば、それを返す。
 * そうした1本が無く、曲のムービーが1本以下なら、そのムービーをすべて返す。
 * 3rd〜8thの曲は、載せる1本を常に1本目のフィールドから参照する。
 * 一方、表の`slot`は素材の曲DBでの順番なので、2本目を指すことがある
 */
function ownVideosOf(
  song: ManifestSong,
  slot: number,
  ports: AdoptionPorts,
): ManifestAsset[] {
  const videos = song.assets.filter(({ kind }) => kind === "video");
  const field = ports.videoFieldOffset(slot);
  const matched = videos.filter(({ references }) =>
    references.some(({ fieldOffset }) => fieldOffset === field)
  );
  if (matched.length === 1) {
    return matched;
  }
  if (videos.length < 2) {
    return videos;
  }
  return fail(`${nameOf(song)}に${slot}本目のムービーが無い`);
}

/**
 * ムービーの印は曲に1つしか無い。
 * 2本目だけを差し替えるときは、曲の今の印を変えられない。そのため、採用元の印が今の印と同じでなければ止める
 */
function flagsOf(
  song: ManifestSong,
  adopted: Adopted,
  fields: readonly number[],
  ports: AdoptionPorts,
): number {
  if (
    fields.includes(ports.videoFieldOffset(0)) ||
    adopted.flags === videoFlagsOf(song, ports)
  ) {
    return adopted.flags;
  }
  return fail(`${nameOf(song)}の2本目の採用元と、ムービーの印が違う`);
}

/** 曲DBのムービーフィールドに、置いた資産かPBのABC indexを参照させる */
function redirect<S extends ManifestSong>(
  song: S,
  adopted: Adopted,
  slot: number,
  ports: AdoptionPorts,
): S {
  const own = ownVideosOf(song, slot, ports);
  const fields = [
    ...own.flatMap(({ references }) =>
      references.map(({ fieldOffset }) => fieldOffset)
    ),
    ...song.videoFields,
  ];
  if (fields.length === 0) {
    fail(`${nameOf(song)}にムービー欄が無い`);
  }
  const entry = ports.redirectVideo(
    song.entry,
    flagsOf(song, adopted, fields, ports),
    fields,
    "abcIndex" in adopted ? adopted.abcIndex : undefined,
  );
  const others = song.assets.filter((asset) => !own.includes(asset));
  const uncorrected = withOwnVideos(song, own);
  const base = {
    ...song,
    entry,
    ...(uncorrected === undefined ? {} : { uncorrected }),
    videoFields: [],
  };
  if ("abcIndex" in adopted) {
    return { ...base, assets: others };
  }
  const { sourceGeneration, ...asset } = adopted.asset;
  const video: ManifestAsset = {
    ...asset,
    references: fields.map((fieldOffset) => ({ fieldOffset, width: "u32" })),
    ...(sourceGeneration === song.sourceGeneration ? {} : { sourceGeneration }),
  };
  // ディスク配置は譜面 → ムービー → 音の順
  const at = others.findIndex(({ kind }) => kind !== "chart");
  const assets = at < 0
    ? [...others, video]
    : [...others.slice(0, at), video, ...others.slice(at)];
  return { ...base, assets };
}

/**
 * その曲が差し替える前に持っていたムービーを、補正前の値に足す。
 * 共有BGAへ向けた曲には、原作のムービーがすでに入っている。その値は書き換えない
 */
function withOwnVideos(
  song: ManifestSong,
  own: readonly ManifestAsset[],
): ManifestSong["uncorrected"] {
  if (song.uncorrected?.videos !== undefined || own.length === 0) {
    return song.uncorrected;
  }
  return {
    ...song.uncorrected,
    videos: own.map((asset) => ({
      sourceFileIndex: asset.sourceFileIndex,
      sourceGeneration: assetGenerationOf(song, asset),
    })),
  };
}

/** 差し替えた曲の数も返す。表の曲が載らない構成(落とした曲など)では、その行は使わない */
export function adoptVideos<S extends ManifestSong>(
  songs: S[],
  adoptions: VideoAdoption[],
  sources: AdoptionSources,
): { songs: S[]; adopted: number } {
  const byKey = Map.groupBy(
    [...adoptions].sort((a, b) => a.slot - b.slot),
    ({ song }) => keyOf(song),
  );
  const cache = new Map<string, Adopted>();
  const adoptedOf = (adopt: SongId, adoptSlot: number) => {
    const key = keyOf(adopt) + "#" + adoptSlot;
    const found = cache.get(key) ??
      (adopt.generation === PB
        ? adoptedInPb(sources, adopt)
        : adoptedInCsa(sources, adopt, adoptSlot));
    cache.set(key, found);
    return found;
  };
  let adopted = 0;
  const result = songs.map((song) => {
    const rows = byKey.get(
      keyOf({
        generation: song.sourceGeneration,
        songId: song.sourceSongIndex,
      }),
    );
    if (rows === undefined) {
      return song;
    }
    adopted++;
    return rows.reduce(
      (current, { adopt, adoptSlot, slot }) =>
        redirect(current, adoptedOf(adopt, adoptSlot), slot, sources.ports),
      song,
    );
  });
  return { songs: result, adopted };
}
