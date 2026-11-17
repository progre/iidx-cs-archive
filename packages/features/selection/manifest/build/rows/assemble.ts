// manifest全体の組み立て。キーの並びは、書き出すJSONの並びになる。

import type {
  FreedPbFile,
  IndividualAssetManifest,
  ManifestPbBack,
  ManifestSong,
  ManifestSource,
  PbLevels,
  PbVersion,
  PbVideoRedirect,
} from "@csa/core";

export interface ManifestParts<S extends ManifestSong = ManifestSong> {
  freedPbFiles: FreedPbFile[];
  pbBacks?: ManifestPbBack[];
  pbLevels?: PbLevels[];
  pbVersions?: PbVersion[];
  pbVideoRedirects: PbVideoRedirect[];
  /** 共有BGAのABC index。動画として共有BGAを参照させる曲があるときに書く */
  sharedVideoAbcIndex: number;
  songs: S[];
  sources: Record<string, ManifestSource>;
  targetSongCount: number;
}

export function assembleManifest<S extends ManifestSong>(
  parts: ManifestParts<S>,
): Omit<IndividualAssetManifest, "songs"> & { songs: S[] } {
  const { songs } = parts;
  const fallbackCount =
    songs.filter((song) => song.videoFields.length > 0).length;
  return {
    expectedNewAbcCount: songs.reduce(
      (sum, song) => sum + song.assets.length,
      0,
    ),
    freedPbFiles: parts.freedPbFiles,
    ...(parts.pbBacks === undefined || parts.pbBacks.length === 0
      ? {}
      : { pbBacks: parts.pbBacks }),
    ...(parts.pbLevels === undefined || parts.pbLevels.length === 0
      ? {}
      : { pbLevels: parts.pbLevels }),
    ...(parts.pbVersions === undefined || parts.pbVersions.length === 0
      ? {}
      : { pbVersions: parts.pbVersions }),
    pbVideoRedirects: parts.pbVideoRedirects,
    ...(fallbackCount > 0
      ? { sharedVideoAbcIndex: parts.sharedVideoAbcIndex }
      : {}),
    sources: parts.sources,
    targetSongCount: parts.targetSongCount,
    songs,
  };
}
