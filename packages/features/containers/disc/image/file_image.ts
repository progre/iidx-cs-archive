// イメージファイルを読み書きする実装。原盤のパスを開くのはここだけである。

import { Iso9660 } from "../volume/mod.ts";
import type { DiscImage } from "@csa/core";
import type { ImageSink } from "./image_writer.ts";

export class FileDiscImage implements DiscImage {
  private constructor(
    private readonly file: Deno.FsFile,
    readonly size: number,
  ) {}

  static async open(path: string): Promise<FileDiscImage> {
    const file = await Deno.open(path, { read: true });
    return new FileDiscImage(file, (await file.stat()).size);
  }

  async readAt(offset: number, length: number): Promise<Uint8Array> {
    const buf = new Uint8Array(length);
    await this.readInto(offset, buf);
    return buf;
  }

  async readInto(offset: number, buffer: Uint8Array): Promise<void> {
    await this.file.seek(offset, Deno.SeekMode.Start);
    let got = 0;
    while (got < buffer.length) {
      const read = await this.file.read(buffer.subarray(got));
      if (read === null) {
        break;
      }
      got += read;
    }
    if (got < buffer.length) {
      throw new Error(
        `読み込み不足: off=${offset} want=${buffer.length} got=${got}`,
      );
    }
  }

  close(): void {
    this.file.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

/** イメージファイルをISO9660として開く */
export async function openIso9660File(path: string): Promise<Iso9660> {
  return new Iso9660(await FileDiscImage.open(path));
}

/** 出力イメージのファイル。既にあれば作り直す */
export async function createImageSinkFile(path: string): Promise<ImageSink> {
  const file = await Deno.open(path, {
    create: true,
    truncate: true,
    write: true,
  });
  return {
    seek: async (offset) => {
      await file.seek(offset, Deno.SeekMode.Start);
    },
    write: async (data) => {
      let done = 0;
      while (done < data.length) {
        done += await file.write(data.subarray(done));
      }
    },
    close: () => file.close(),
  };
}

/**
 * ディレクトリ内の最初の原盤イメージ(.bin か .iso)を返す。
 * 原盤は .bin と .cue の組で置くが、US は .iso 1つで置いている。
 */
export async function findImage(dir: string): Promise<string> {
  for await (const e of Deno.readDir(dir)) {
    const name = e.name.toLowerCase();
    if (e.isFile && (name.endsWith(".bin") || name.endsWith(".iso"))) {
      return `${dir}/${e.name}`;
    }
  }
  throw new Error(`${dir} に原盤イメージが無い`);
}
