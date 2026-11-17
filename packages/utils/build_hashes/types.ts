/** ファイル1本の大きさと SHA-256。絶対 LBA で参照される資産は置き場の LBA も持つ */
export interface FileDigest {
  size: number;
  sha256: string;
  lba?: number;
}

/** ISO の記録。files は ISO9660 のファイル、extents は絶対 LBA で参照される資産 */
export interface IsoRecord {
  files: DigestTable;
  extents: DigestTable;
}

/** パス(対象のフォルダーからの `/` 区切り) -> ハッシュ */
export type DigestTable = Record<string, FileDigest>;

export type DifferenceKind = "changed" | "missing" | "added";

export interface Difference {
  path: string;
  kind: DifferenceKind;
}

/** 中間物の1グループ。root の下で pattern に一致する相対パスのファイルを対象にする */
export interface GroupSpec {
  root: string;
  /** 相対パスに対する正規表現(RegExp のソース) */
  pattern: string;
}

export interface GroupRecord extends GroupSpec {
  files: DigestTable;
}

export type IntermediateRecord = Record<string, GroupRecord>;
