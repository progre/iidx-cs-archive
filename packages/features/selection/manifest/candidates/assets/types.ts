import type { Resolution } from "@csa/core";

export type Era = "era1" | "era2" | "era3";

/** 曲が参照する原盤のファイル。songmapのファイルの一部 */
export interface SourceFile {
  archive: string;
  index: number;
  offset: number;
  size: number;
}

/** 採用した era1 ムービーと、それを使う曲 */
export interface Era1VideoJob {
  songIds: readonly number[];
  video: {
    archive: string;
    generation: string;
    key: string;
    offset: number;
  };
}

export interface AssetContext {
  era: Era;
  /** era1のみ。採用したムービーの`sourceKeyOf` → job */
  era1Jobs: ReadonlyMap<string, Era1VideoJob>;
  files: ReadonlyMap<number, SourceFile>;
  generation: string;
  /** era2/era3の動画の解像度を原盤から読む */
  readResolution(file: SourceFile): Promise<Resolution>;
  /** 2つのファイルの中身が、バイト単位で同じか */
  sameBytes(a: SourceFile, b: SourceFile): Promise<boolean>;
}
