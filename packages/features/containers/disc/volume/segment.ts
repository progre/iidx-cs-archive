// songmap の files[i](アーカイブ名+オフセット)を、原盤イメージから直接読むための共通処理。

import { SEC } from "@csa/core";
import type { Iso9660 } from "./iso9660.ts";

// ISO のルートに置かれたファイル(実行ファイルなど)を、バイト列として取り出す。
/** 取り出しに使うプロパティだけを持つ型。`Iso9660` が満たす */
export interface RootFileSource {
  collectPaths(): Promise<Map<string, { lba: number; size: number }>>;
  readAt(offset: number, length: number): Promise<Uint8Array>;
}

/** ルート直下のファイルを読む。名前は大文字・バージョン抜きで引く */
export async function readRootFile(
  source: RootFileSource,
  name: string,
): Promise<Uint8Array> {
  const found = (await source.collectPaths()).get(name.toUpperCase());
  if (found === undefined) {
    throw new Error(`ISO のルートに ${name} が無い`);
  }
  return await source.readAt(found.lba * SEC, found.size);
}

export interface Disc {
  disc: Iso9660;
  files: Map<string, { lba: number; size: number }>;
}

/** songmap の files[i] とディスクのファイル表から、アーカイブ内の一区間を読む。 */
export async function readSegment(
  disc: Disc,
  f: { archive: string; offset: number; size: number },
): Promise<Uint8Array> {
  const arc = disc.files.get(f.archive.toUpperCase());
  if (!arc) throw new Error(`イメージ内に ${f.archive} が無い`);
  if (f.offset + f.size > arc.size) {
    throw new Error(`アーカイブ範囲外 ${f.archive}+${f.offset}`);
  }
  return await disc.disc.readAt(arc.lba * SEC + f.offset, f.size);
}
