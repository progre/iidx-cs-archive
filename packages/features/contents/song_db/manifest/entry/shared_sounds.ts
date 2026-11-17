// 全曲リストの`share`で、音をPB原盤の曲と共有する曲の、曲DBの音の欄を書く。
// 共有する曲は音の資産を置かないので、欄にはPBの曲のABC indexを書く。

import { type SoundFieldWrite, writeSoundFields } from "../../pb/mod.ts";
import type { PbEntryFormat } from "../../pb/format/mod.ts";
import type { ManifestSongDraft, SongmapSong } from "@csa/core";

type Row = Pick<
  ManifestSongDraft,
  "share" | "sourceAssets" | "sourceGeneration" | "sourceSongIndex"
>;

const labelOf = (row: Row) =>
  `${row.sourceGeneration} song${row.sourceSongIndex}`;

/** `share`に書いた管理名で、PB原盤の曲を引く。無ければ止める */
export function pbSongOf(
  row: Row,
  pbSongs: readonly SongmapSong[],
): SongmapSong {
  const found = pbSongs.find((song) => song.title === row.share);
  if (found === undefined) {
    throw new Error(`${labelOf(row)}のshareに書いた${row.share}がPBに無い`);
  }
  return found;
}

/** 曲の音の資産が使う組に、PBの曲の同じ組の音を書く。PBの曲に無い組を使っていれば止める */
export function withPbSounds(
  format: PbEntryFormat,
  entryText: string,
  row: Row,
  pbSong: SongmapSong,
): string {
  const soundOf = new Map(pbSong.sounds.map((sound) => [sound.pair, sound]));
  const writes: SoundFieldWrite[] = [];
  for (const asset of row.sourceAssets) {
    if (asset.kind !== "bgm" && asset.kind !== "keysound") {
      continue;
    }
    for (const pair of asset.fields) {
      const sound = soundOf.get(pair);
      const index = asset.kind === "bgm" ? sound?.bgm : sound?.keysound;
      if (index == null) {
        throw new Error(
          `${
            labelOf(row)
          }の${pair}の${asset.kind}が、PBの${pbSong.title}に無い`,
        );
      }
      writes.push({ index, kind: asset.kind, pair });
    }
  }
  return writeSoundFields(format, entryText, writes);
}
