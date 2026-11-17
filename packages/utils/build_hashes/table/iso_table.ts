import { type Iso9660, openIso9660File } from "@csa/containers-disc";
import { SEC } from "@csa/core";
import type { Extent } from "../record/mod.ts";
import type { DigestTable, FileDigest } from "../types.ts";
import { createHash } from "node:crypto";

const CHUNK = 16 * 1024 * 1024;

/** 読み出し元(offset, length -> bytes)から size バイトを順に読んでハッシュする */
export async function digestOf(
  size: number,
  readAt: (offset: number, length: number) => Promise<Uint8Array>,
): Promise<FileDigest> {
  const hash = createHash("sha256");
  for (let done = 0; done < size; done += CHUNK) {
    hash.update(await readAt(done, Math.min(CHUNK, size - done)));
  }
  return { size, sha256: hash.digest("hex") };
}

export async function digestOfFile(path: string): Promise<FileDigest> {
  using file = await Deno.open(path);
  const size = (await file.stat()).size;
  return await digestOf(size, async (offset, length) => {
    const buffer = new Uint8Array(length);
    await file.seek(offset, Deno.SeekMode.Start);
    let got = 0;
    while (got < length) {
      const read = await file.read(buffer.subarray(got));
      if (read === null) {
        throw new Error(
          `${path}: ${offset + got} でファイルが途中で終わっている`,
        );
      }
      got += read;
    }
    return buffer;
  });
}

async function digestAt(
  iso: Iso9660,
  lba: number,
  size: number,
): Promise<FileDigest> {
  return await digestOf(
    size,
    (offset, length) => iso.readAt(lba * SEC + offset, length),
  );
}

/** ISO9660 のディレクトリーに載る全ファイルのハッシュ表。日時を持つディレクトリーレコードは対象にしない */
export async function isoTable(isoPath: string): Promise<DigestTable> {
  using iso = await openIso9660File(isoPath);
  const entries = [...await iso.collectPaths()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const table: DigestTable = {};
  for (const [path, entry] of entries) {
    table[path] = await digestAt(iso, entry.lba, entry.size);
  }
  return table;
}

/** ディレクトリーに載らず絶対 LBA で参照される資産のハッシュ表 */
export async function extentTable(
  isoPath: string,
  extents: readonly Extent[],
): Promise<DigestTable> {
  using iso = await openIso9660File(isoPath);
  const table: DigestTable = {};
  for (const { key, lba, size } of extents) {
    table[key] = { ...await digestAt(iso, lba, size), lba };
  }
  return table;
}
