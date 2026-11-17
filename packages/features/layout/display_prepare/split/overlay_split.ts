// 演奏中の`.if`読み込み領域に収まらない曲中オーバーレイを場面ごとに分けるとき、
// 分ける本の選び出しと、分けた本を差し込んだmanifestの振り直しを決める。バイト列は扱わない。

import {
  type DisplaySong,
  type ManifestOverlayPackage,
  overlayKey,
  type OverLimitPackage,
  parseGeneratedSource,
  SEC,
} from "@csa/core";

/** 分けた1本。組は自分のanimationを持つ本を選ぶ */
export interface OverlayPart {
  animations: readonly number[] | null;
  package: ManifestOverlayPackage;
}

export interface OverlayLimits {
  /** 曲の一覧の枠数 */
  packageCount: number;
  /** 1本のセクタ数の上限 */
  sectorLimit: number;
}

const sectorsOf = (bytes: number) => Math.ceil(bytes / SEC);

/** 上限を超えるパッケージを、それを指す曲の場面と残り枠とともに集める */
export function overLimitPackages(
  manifest: { songs: readonly DisplaySong[] },
  limits: OverlayLimits,
): Map<string, OverLimitPackage> {
  const sources = new Map<string, OverLimitPackage>();
  for (const song of manifest.songs) {
    const overlay = song.overlay;
    if (overlay === undefined) continue;
    overlay.packages.forEach((item, at) => {
      if (sectorsOf(item.sourceSize) <= limits.sectorLimit) return;
      const key = overlayKey(song.sourceGeneration, item);
      const found = sources.get(key) ?? {
        budget: limits.packageCount,
        generation: song.sourceGeneration,
        item,
        scenes: new Set<number>(),
      };
      found.budget = Math.min(
        found.budget,
        limits.packageCount - overlay.packages.length + 1,
      );
      for (const pair of overlay.pairs) {
        if (pair?.packageIndex === at) found.scenes.add(pair.animation);
      }
      sources.set(key, found);
    });
  }
  return sources;
}

/** 分けた本を元の位置へ順に差し込み、組を新しい添字へ振り直す。枠の位置は変えない */
export function rewriteOverlayPackages<
  M extends { songs: readonly DisplaySong[] },
>(
  manifest: M,
  parts: ReadonlyMap<string, readonly OverlayPart[]>,
  packageCount: number,
): M {
  const songs = manifest.songs.map((song) => {
    const overlay = song.overlay;
    if (overlay === undefined) return song;
    const mapped: (readonly OverlayPart[])[] = overlay.packages.map((item) =>
      parts.get(overlayKey(song.sourceGeneration, item)) ??
        [{ animations: null, package: item }]
    );
    const first: number[] = [];
    let total = 0;
    for (const list of mapped) {
      first.push(total);
      total += list.length;
    }
    if (total > packageCount) {
      throw new Error(
        `${song.sourceGeneration} song${song.sourceSongIndex}のパッケージが${total}本`,
      );
    }
    const pairs = overlay.pairs.map((pair) => {
      if (pair === null) return null;
      const list = mapped[pair.packageIndex];
      if (list === undefined) {
        throw new Error(
          `${song.sourceGeneration} song${song.sourceSongIndex}の組が一覧の外を指す`,
        );
      }
      const at = list.findIndex((part) =>
        part.animations === null || part.animations.includes(pair.animation)
      );
      if (at < 0) {
        throw new Error(
          `${song.sourceGeneration} song${song.sourceSongIndex}のanimation ${pair.animation}が分けた本に無い`,
        );
      }
      return {
        animation: pair.animation,
        packageIndex: first[pair.packageIndex] + at,
      };
    });
    return {
      ...song,
      overlay: { packages: mapped.flat().map((part) => part.package), pairs },
    };
  });
  return { ...manifest, songs };
}

/**
 * 分ける本の実体が単体ファイルならそのパス、素材のDATA1ならnull。
 * 並べ替えた本は単体ファイルに置かれ、そのままの世代はDATA1に残る。
 */
export function packageFilePath(
  item: ManifestOverlayPackage,
  files: ReadonlyMap<string, string>,
  dataArchive: string,
): string | null {
  if (item.sourceArchive === dataArchive) {
    return null;
  }
  const path = files.get(item.sourceArchive);
  if (path === undefined) {
    throw new Error(`${item.sourceArchive}を単体ファイルとして引けない`);
  }
  return path;
}

/**
 * manifestが参照する単体ファイル(資産・曲名カード・曲中オーバーレイ)を
 * source key → path で集める。名前の決まりは`generatedSourceArchive`・`parseGeneratedSource`が持つ
 */
export function fileSourcesOf(
  manifest: { songs: readonly DisplaySong[] },
): Map<string, string> {
  const files = new Map<string, string>();
  for (const song of manifest.songs) {
    const archives = song.assets.map((asset) => asset.sourceArchive);
    if (song.titleCard !== undefined) {
      archives.push(song.titleCard.sourceArchive);
    }
    for (const item of song.overlay?.packages ?? []) {
      archives.push(item.sourceArchive);
    }
    for (const archive of archives) {
      const source = parseGeneratedSource(archive);
      if (source?.kind === "file") {
        files.set(archive, source.name);
      }
    }
  }
  return files;
}
