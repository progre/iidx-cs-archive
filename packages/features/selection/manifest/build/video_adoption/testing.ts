// adoption/のテストが使う、ダミーの曲・曲の行・採用の入力。

import type { ManifestSong, ManifestSongDraft, SourceAsset } from "@csa/core";
import type { AdoptionPorts, AdoptionSources } from "../adoption/mod.ts";

/** 1本目のムービーの欄。2本目以降は4バイトずつ後ろにある */
const VIDEO_FIELD = 0x58;

/** テストのエントリー。曲DBの形式の代わりに、欄の位置と値の対応とムービーの印だけを持つ */
interface TestEntry {
  fields: Record<number, number>;
  flags: number;
}

const encode = (entry: TestEntry) => JSON.stringify(entry);
const decode = (text: string): TestEntry => JSON.parse(text);

/** テストで使う、全欄が0のエントリー */
export const dummyEntry = encode({ fields: {}, flags: 0 });

/** エントリーの`field`の位置の値 */
export const fieldOf = (entry: string, field: number): number =>
  decode(entry).fields[field] ?? 0;

/** エントリーの、ムービーの印の下位2bitと、1本目のムービーの欄 */
export function videoOf(entry: string): { abc: number; flags: number } {
  return {
    abc: fieldOf(entry, VIDEO_FIELD),
    flags: decode(entry).flags & 0x03,
  };
}

/** テストのエントリーを読み書きする ports。本物と同じく、ムービーの印は下位2bitだけを書き換える */
export const testPorts: AdoptionPorts = {
  convertedFileOf: (output) => ({ archive: "file:" + output, size: 1 }),
  needsLargeBuffer: ({ height, width }) => width > 240 || height > 240,
  redirectVideo: (text, flags, fields, abcIndex) => {
    const entry = decode(text);
    entry.flags = (entry.flags & ~0x03) | flags;
    if (abcIndex !== undefined) {
      fields.forEach((field) => entry.fields[field] = abcIndex);
    }
    return encode(entry);
  },
  videoFieldOffset: (slot) => VIDEO_FIELD + slot * 4,
  videoFlagsOfEntry: (text) => decode(text).flags,
};

export function songOf(
  generation: string,
  songId: number,
  video: "asset" | "fallback",
): ManifestSong {
  const references = [{ fieldOffset: VIDEO_FIELD, width: "u32" as const }];
  return {
    assets: [
      {
        kind: "chart",
        references: [{ fieldOffset: 0x10, width: "u32" }],
        sourceArchive: "A.BIN",
        sourceFileIndex: 1,
        sourceOffset: 0,
        sourceSize: 10,
      },
      ...(video === "asset"
        ? [{
          kind: "video" as const,
          references,
          sourceArchive: "A.BIN",
          sourceFileIndex: 2,
          sourceOffset: 100,
          sourceSize: 20,
        }]
        : []),
    ],
    canonicalKey: "SONG",
    entry: dummyEntry,
    sourceGeneration: generation,
    sourceSongIndex: songId,
    targetSongIndex: 99,
    title: "song",
    videoFields: video === "fallback" ? [VIDEO_FIELD] : [],
  };
}

export function videoAsset(offset: number, width: number): SourceAsset {
  return {
    fields: ["0"],
    kind: "video",
    path: "copy",
    resolution: { height: width, width },
    sourceArchive: "DATA2.DAT",
    sourceFileIndex: 7,
    sourceOffset: offset,
    sourceSize: 30,
  };
}

/** `flags`は`世代/song_id`から`+0x62`の値への対応である */
export function sourcesOf(
  songs: { generation: string; songId: number; asset: SourceAsset }[],
  flags: Map<string, number>,
  pbSongs: { song_id: number; videos: number[] }[] = [
    { song_id: 5, videos: [900] },
  ],
  pbFiles: AdoptionSources["pbSongmap"]["files"] = [],
): AdoptionSources {
  return {
    pbSongmap: { files: pbFiles, songs: pbSongs },
    songs: songs.map(({ generation, songId, asset }) => ({
      sourceAssets: [asset],
      sourceGeneration: generation,
      sourceSongIndex: songId,
    })) as unknown as ManifestSongDraft[],
    videoFlagsOf: ({ generation, songId }) =>
      flags.get(`${generation}/${songId}`) ?? 0,
    ports: testPorts,
  };
}

export { VIDEO_FIELD };
