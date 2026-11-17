// 原盤イメージ(MODE1/2048 = ISO相当)から ISO9660 のファイル表を読む。
//
// songmap の `files[i]` が持つのは、アーカイブの名前と、アーカイブの先頭からのバイト位置である。
// アーカイブがディスクのどのLBAにあるかは、ここで ISO9660 のファイル表から引く。
// 抽出作業を挟まずに原盤から直接バンクを読むための土台。

import { SEC } from "@csa/core";
import type { DiscImage } from "@csa/core";

export interface DirEnt {
  name: string;
  lba: number;
  size: number;
  isDir: boolean;
  /** イメージ先頭からのディレクトリレコード位置。extent/sizeの書き換えに使う */
  recordOffset: number;
}

export interface DiscReader {
  readAt(off: number, len: number): Promise<Uint8Array>;
  /** ルートから再帰して全ファイルを集める。キーは大文字・バージョン抜きの名前 */
  collectFiles(): Promise<Map<string, DirEnt>>;
}

export class Iso9660 implements DiscReader, DiscImage {
  constructor(private readonly image: DiscImage) {}

  get size(): number {
    return this.image.size;
  }

  close() {
    this.image.close();
  }
  [Symbol.dispose]() {
    this.close();
  }

  readAt(
    off: number,
    len: number,
  ): Promise<Uint8Array> {
    return this.image.readAt(off, len);
  }

  readInto(offset: number, buffer: Uint8Array): Promise<void> {
    return this.image.readInto(offset, buffer);
  }

  /** ルートから再帰して全ファイルを集める。キーは大文字・バージョン抜きの名前 */
  async collectFiles(): Promise<Map<string, DirEnt>> {
    const found = new Map<string, DirEnt>();
    for (const entry of (await this.collectPaths()).values()) {
      if (!found.has(entry.name)) {
        found.set(entry.name, entry);
      }
    }
    return found;
  }

  /** ルートから再帰して全ファイルを集める。キーはルートからの `/` 区切りのパス */
  async collectPaths(): Promise<Map<string, DirEnt>> {
    const pvd = await this.readAt(16 * SEC, SEC);
    const magic = new TextDecoder().decode(pvd.subarray(1, 6));
    if (pvd[0] !== 1 || magic !== "CD001") {
      throw new Error(
        `ISO9660 の PVD が無い(MODE1/2048 か確認する): type=${
          pvd[0]
        } magic=${magic}`,
      );
    }
    const rootDv = new DataView(pvd.buffer, pvd.byteOffset + 156, 34);
    const found = new Map<string, DirEnt>();
    const queue = [{
      lba: rootDv.getUint32(2, true),
      size: rootDv.getUint32(10, true),
      prefix: "",
    }];
    const seen = new Set<number>();
    while (queue.length) {
      const d = queue.shift()!;
      if (seen.has(d.lba)) continue;
      seen.add(d.lba);
      const buf = await this.readAt(
        d.lba * SEC,
        Math.ceil(d.size / SEC) * SEC,
      );
      for (const e of readDirRecords(buf, d.lba * SEC)) {
        if (e.name === "" || e.name === "\0" || e.name === "\x01") continue;
        const path = d.prefix + e.name;
        if (e.isDir) {
          queue.push({ lba: e.lba, size: e.size, prefix: `${path}/` });
        } else if (!found.has(path)) {
          found.set(path, e);
        }
      }
    }
    return found;
  }
}

export function readDirRecords(buf: Uint8Array, baseOffset: number): DirEnt[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: DirEnt[] = [];
  let p = 0;
  while (p < buf.length) {
    const len = buf[p];
    if (len === 0) {
      // 残りは同一セクタ内のパディング。次のセクタ先頭へ送る
      const next = (Math.floor(p / SEC) + 1) * SEC;
      if (next >= buf.length) break;
      p = next;
      continue;
    }
    const nameLen = buf[p + 32];
    const name = new TextDecoder().decode(
      buf.subarray(p + 33, p + 33 + nameLen),
    )
      .split(";")[0].toUpperCase();
    out.push({
      name,
      lba: dv.getUint32(p + 2, true),
      size: dv.getUint32(p + 10, true),
      isDir: (buf[p + 25] & 0x02) !== 0,
      recordOffset: baseOffset + p,
    });
    p += len;
  }
  return out;
}
