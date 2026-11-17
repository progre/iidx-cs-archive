// 曲中オーバーレイには、演奏中の`.if`読み込み領域に収まらないものがある。
// それを場面ごとに分けて`<discsDirectory>/<世代>/overlays/NNNN_<n>.if`へ置く。場面は、組が指すanimationである。
// どの`.if`を分けるかは、呼び出し側が渡す関数で決める。
// 入力は並べ替え後の形で、hs以降は素材のDATA1からそのまま読む。

import {
  type DisplaySong,
  generatedSourceArchive,
  type ManifestOverlayPackage,
  type OverLimitPackage,
} from "@csa/core";
import { PB_PACKAGE_COUNT } from "../write/mod.ts";
import { readSourceFile, writePartFiles } from "./split_gateway.ts";
import {
  partPathOf,
  planSplitParts,
  type SplitPlanPorts,
} from "./split_plan.ts";

/** 素材のアーカイブの範囲を読む。使い終わったら`close`する */
interface SourceReader {
  close: () => void;
  read: (input: {
    generation: string;
    sourceOffset: number;
    sourceSize: number;
  }) => Promise<Uint8Array>;
}

/** `Lap`は周回で開いた原盤で、中身は`openSourceReader`だけが読む */
export interface OverlaySplitPorts<Lap> extends SplitPlanPorts {
  /** 素材世代のDATA1アーカイブ名 */
  dataArchive: string;
  fileSourcesOf: (
    manifest: { songs: readonly DisplaySong[] },
  ) => ReadonlyMap<string, string>;
  ifDirectoryOf: (
    discsDirectory: string,
    generation: string,
    folder: "overlays",
  ) => string;
  openSourceReader: (discsDirectory: string, lap: Lap) => SourceReader;
  overLimitPackages: (
    manifest: { songs: readonly DisplaySong[] },
    limits: { packageCount: number; sectorLimit: number },
  ) => ReadonlyMap<string, OverLimitPackage>;
  packageFilePath: (
    item: ManifestOverlayPackage,
    files: ReadonlyMap<string, string>,
    dataArchive: string,
  ) => string | null;
  /** 1本のセクタ数の上限 */
  sectorLimit: number;
}

export interface SplitOverlayPart {
  animations: number[];
  package: ManifestOverlayPackage;
}

/** 並べ替えを経た本は単体ファイル、そのままの世代は素材のDATA1から読む */
async function readSource<Lap>(
  ports: OverlaySplitPorts<Lap>,
  source: OverLimitPackage,
  files: ReadonlyMap<string, string>,
  reader: SourceReader,
): Promise<Uint8Array> {
  const path = ports.packageFilePath(source.item, files, ports.dataArchive);
  if (path !== null) {
    return readSourceFile(path);
  }
  return await reader.read({
    generation: source.generation,
    sourceOffset: source.item.sourceOffset,
    sourceSize: source.item.sourceSize,
  });
}

function splitSource<Lap>(
  ports: OverlaySplitPorts<Lap>,
  source: OverLimitPackage,
  bytes: Uint8Array,
  discsDirectory: string,
  files: string[],
): SplitOverlayPart[] {
  const directory = ports.ifDirectoryOf(
    discsDirectory,
    source.generation,
    "overlays",
  );
  const planned = planSplitParts(ports, source, bytes).map((part, at) => ({
    ...part,
    path: partPathOf(ports, directory, source.item.sourceFileIndex, at),
  }));
  files.push(...planned.map((part) => part.path));
  writePartFiles(directory, planned);
  return planned.map((part) => ({
    animations: part.animations,
    package: {
      sourceArchive: generatedSourceArchive("file", part.path),
      sourceFileIndex: source.item.sourceFileIndex,
      sourceOffset: 0,
      sourceSize: part.bytes.length,
    },
  }));
}

/**
 * 上限を超える本は、分けて置く。
 * 分けた本の一覧を返す。一覧の項目は、元の本の鍵で探せる。
 */
export async function splitOverlayPackages<Lap>(
  ports: OverlaySplitPorts<Lap>,
  manifest: { songs: readonly DisplaySong[] },
  discsDirectory: string,
  lap: Lap,
): Promise<{ files: string[]; parts: Map<string, SplitOverlayPart[]> }> {
  const sources = ports.overLimitPackages(manifest, {
    packageCount: PB_PACKAGE_COUNT,
    sectorLimit: ports.sectorLimit,
  });
  const parts = new Map<string, SplitOverlayPart[]>();
  const sourceFiles = ports.fileSourcesOf(manifest);
  const files: string[] = [];
  const reader = ports.openSourceReader(discsDirectory, lap);
  try {
    for (const [key, source] of sources) {
      const bytes = await readSource(ports, source, sourceFiles, reader);
      parts.set(key, splitSource(ports, source, bytes, discsDirectory, files));
    }
  } finally {
    reader.close();
  }
  return { files, parts };
}
