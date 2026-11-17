// djt・empのように、曲DBエントリを素材ELFからそのまま写せる曲。

import type { ManifestSongDraft } from "@csa/core";
import { SongDb } from "../song_db.ts";
import { readFileFields } from "../pb/mod.ts";
import { versionByteOf } from "../version/mod.ts";
import type { DraftBody, DraftPorts, LoadedSource } from "./sources.ts";

/**
 * 世代の中で決まる部分。エントリの作品番号は、素材のまま残してある。
 * 原盤の作品番号1は、1st style と substream のどちらにも使われていた。
 * どちらの作品かは、その世代の ELF が index で区別していた。
 * そのため、素材の作品番号は、ほかの曲と同じ規則で読み替える材料として持つ。
 */
export function copiedDraft<Legacy>(
  ports: DraftPorts<Legacy>,
  row: ManifestSongDraft,
  source: LoadedSource<Legacy>,
): DraftBody {
  if (!source.copied) {
    throw new Error(`${row.sourceGeneration}は曲DBを写せない`);
  }
  const { format } = ports;
  const entry = new SongDb(
    source.elf,
    ports.definitionOf(row.sourceGeneration),
  ).bytesOf(row.sourceSongIndex);
  const built = ports.copiedAssets(
    row,
    source.songmap,
    readFileFields(format, entry),
    !ports.isPlayable(row),
  );
  return {
    ...row,
    assets: built.assets,
    draftEntry: entry.slice(),
    overlay: ports.overlayOf(row, source, entry),
    sourceVersion: versionByteOf(format.recordOf(entry)),
    titleCard: ports.titleCardOf(row, source),
    videoFields: built.videoFields,
  };
}
