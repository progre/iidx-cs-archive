// 全曲リストの`exclude`で外した曲を、曲リストへ載せる形にする。
// 曲DBエントリには、収録する曲と同じ規則で、作品番号と全曲リストの難易度を書く。

import type { CatalogRow, ExcludedSong, ManifestSongDraft } from "@csa/core";
import { withLevels } from "../manifest/mod.ts";
import { writeEntryVersion } from "../pb/mod.ts";
import type { EntryFolderRules } from "./song.ts";
import type { DraftedSong, DraftPorts } from "./sources.ts";

function fail(message: string): never {
  throw new Error(message);
}

/** 外した曲も、周回で下書きを作ってある */
function drafted(
  song: ManifestSongDraft,
): DraftedSong & { draftEntry: Uint8Array } {
  const { assets, draftEntry, sourceOverlay, videoFields } = song;
  if (
    assets === undefined || draftEntry === undefined ||
    sourceOverlay === undefined || videoFields === undefined
  ) {
    fail(
      `${song.sourceGeneration} song${song.sourceSongIndex}の下書きが周回で作られていない`,
    );
  }
  return { ...song, assets, draftEntry, sourceOverlay, videoFields };
}

export function excludedSongs<Legacy>(
  { format, levels }: Pick<DraftPorts<Legacy>, "format" | "levels">,
  songs: readonly ManifestSongDraft[],
  catalogRowsOf: ReadonlyMap<string, Map<number, CatalogRow>>,
  folders: EntryFolderRules,
): ExcludedSong[] {
  return songs
    .filter((song) => song.excluded !== undefined)
    .map((song) => {
      const catalogRows = catalogRowsOf.get(song.sourceGeneration) ??
        fail(`${song.sourceGeneration}の全曲リストが周回で読まれていない`);
      const done = drafted(song);
      const versioned = done.draftEntry.slice();
      writeEntryVersion(format, versioned, folders.versionOf(song));
      return {
        ...done,
        entry: withLevels(
          levels,
          format,
          format.encode(versioned),
          song,
          catalogRows,
        ),
      };
    });
}
