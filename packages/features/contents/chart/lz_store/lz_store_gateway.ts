// LZファイルの読み書き。I/Oだけを行う。

import { dirname } from "@std/path";
import type { LzRow } from "./lz_store.ts";

/** `binPath`のフォルダーを作ってから、LZファイルと位置表を書く */
export function writeLzFiles(
  binPath: string,
  indexPath: string,
  bin: Uint8Array,
  indexText: string,
): void {
  Deno.mkdirSync(dirname(binPath), { recursive: true });
  Deno.writeFileSync(binPath, bin);
  Deno.writeTextFileSync(indexPath, indexText);
}

/** LZファイルから、行が指す範囲を読む */
export function readLzBytes(
  binPath: string,
  generation: string,
  row: LzRow,
): Uint8Array {
  using file = Deno.openSync(binPath, { read: true });
  file.seekSync(row.offset, Deno.SeekMode.Start);
  const bytes = new Uint8Array(row.size);
  let read = 0;
  while (read < row.size) {
    const count = file.readSync(bytes.subarray(read));
    if (count === null) {
      throw new Error(`${generation}のLZファイルが足りない: ${row.offset}`);
    }
    read += count;
  }
  return bytes;
}
