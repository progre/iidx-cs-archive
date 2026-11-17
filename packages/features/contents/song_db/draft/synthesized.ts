// 3rd〜goldのように、曲DBエントリを合成する曲。

import type { ManifestSongDraft } from "@csa/core";
import { SongDb } from "../song_db.ts";
import { synthesizeEntry } from "../synthesis/mod.ts";
import { versionByteOf } from "../version/mod.ts";
import type { DraftBody, DraftPorts, LoadedSource } from "./sources.ts";

/**
 * 世代の中で決まる部分。エントリの作品番号は、まだ書いていない。
 * 作品番号を決める材料として、素材の作品番号か新旧の印を読んでおく
 */
export function synthesizedDraft<Legacy>(
  ports: DraftPorts<Legacy>,
  row: ManifestSongDraft,
  source: LoadedSource<Legacy>,
): DraftBody {
  ports.requirePlayable(row, ports.isPlayable(row));
  const { sourceGeneration } = row;
  const song = ports.songmapSongOf(row, source.songmap.songs);
  const definition = ports.definitionOf(sourceGeneration);
  const layout = definition.songDbRecordLayout;
  const record = new SongDb(source.elf, definition).record(song.song_id);
  const { entry, references } = synthesizeEntry(ports.format, {
    hasIndexPrefix: layout.title.hasIndexPrefix,
    record,
    song,
    statsOf: source.statsOf,
    videos: ports.adoptedVideosOf(row),
  });
  const isVersion = layout.selection.origin?.isVersion;
  return {
    ...row,
    assets: ports.synthesizedAssets(row, references),
    draftEntry: entry,
    ...(isVersion === false ? { newOld: versionByteOf(record) } : {}),
    overlay: ports.overlayOf(row, source, entry),
    ...(isVersion === true ? { sourceVersion: versionByteOf(record) } : {}),
    titleCard: ports.titleCardOf(row, source),
    videoFields: [],
  };
}
