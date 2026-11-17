// PB原盤の曲を、曲リストのデータを組む入力にする。曲DBエントリは、PB形式の定義(`PB_ENTRY`)で読む。

import type { PbSong } from "../lap/mod.ts";
import type { ListEntry, PbLevels, PbVersions } from "@csa/core";
import type { ChartPrintsOf, SongListWritePorts } from "../../ports.ts";

/** 索引のうち、PBの曲の管理名を引くのに使う部分 */
export interface PbIndex {
  songs: Readonly<
    Record<
      string,
      { generations: { pb?: readonly { song_id: number }[] } }
    >
  >;
}

type Ports = Pick<SongListWritePorts<unknown>, "pbListEntryOf">;

/**
 * PB原盤の曲DBを読む。配置器はPB原盤の作品番号をCSAの番号に置き換えるので、ここでも同じ置き換えをする。
 * `pbLevels`は、manifestがその曲に持つ全曲リストの難易度である。原盤の値と違えば、原盤の値を補正前として残す
 */
function pbShownOf(
  ports: Ports,
  { entry, song }: PbSong,
  pbLevels: Readonly<Record<string, number>> | undefined,
  folders: PbVersions,
): ListEntry {
  const listed = ports.pbListEntryOf(entry, song.song_id, folders);
  if (pbLevels === undefined) {
    return listed;
  }
  const changed = Object.keys(pbLevels).filter((name) =>
    listed.levels[name] !== pbLevels[name]
  );
  return {
    ...listed,
    levels: { ...listed.levels, ...pbLevels },
    ...(changed.length === 0 ? {} : {
      uncorrected: {
        levels: Object.fromEntries(
          changed.map((name) => [name, listed.levels[name]]),
        ),
      },
    }),
  };
}

/** PBのsong_idから管理名を引く表 */
export function pbKeysOf(index: PbIndex): Map<number, string> {
  return new Map(
    Object.entries(index.songs).flatMap(([key, entry]) =>
      (entry.generations.pb ?? []).map((song) => [song.song_id, key] as const)
    ),
  );
}

/** 管理名の無いPBの曲は、`pb:song_id`をキーにする */
export const pbKeyOf = (keys: ReadonlyMap<number, string>, songId: number) =>
  keys.get(songId) ?? `pb:${songId}`;

export function listedPbSongsOf(
  ports: Ports,
  pbSongs: readonly PbSong[],
  pbLevels: readonly PbLevels[],
  folders: PbVersions,
  index: PbIndex,
  chartPrintsOf: ChartPrintsOf,
) {
  const levelsOf = new Map(
    pbLevels.map((each) => [each.songIndex, each.levels]),
  );
  const keyOf = pbKeysOf(index);
  return pbSongs.map((pb) => ({
    chartPrints: chartPrintsOf("pb", pb.song.song_id),
    key: pbKeyOf(keyOf, pb.song.song_id),
    overlay: pb.overlay,
    shown: pbShownOf(ports, pb, levelsOf.get(pb.song.song_id), folders),
    song: pb.song,
  }));
}
