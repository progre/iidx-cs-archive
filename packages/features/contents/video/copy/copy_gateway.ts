// 原盤から写した映像と、変換した映像のファイルの読み書き。I/Oだけを行う。

import { dirname } from "@std/path";

/** 世代の置き場を空にする。置き場が無ければ何もしない */
export function resetDirectory(directory: string): void {
  try {
    Deno.removeSync(directory, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

/** ファイルの大きさ。ファイルが無ければ`undefined` */
export function fileSizeOf(path: string): number | undefined {
  try {
    return Deno.statSync(path).size;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

export function writeCopyFile(path: string, bytes: Uint8Array): void {
  Deno.mkdirSync(dirname(path), { recursive: true });
  Deno.writeFileSync(path, bytes);
}

/** ファイルの一部を読む。曲リストが、ムービーの末尾のゼロを数えるのに使う */
export async function readFileAt(
  path: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  using file = await Deno.open(path);
  await file.seek(offset, Deno.SeekMode.Start);
  const bytes = new Uint8Array(length);
  let read = 0;
  while (read < length) {
    const count = await file.read(bytes.subarray(read));
    if (count === null) {
      throw new Error(`${path}の${offset + read}バイト目より先が無い`);
    }
    read += count;
  }
  return bytes;
}
