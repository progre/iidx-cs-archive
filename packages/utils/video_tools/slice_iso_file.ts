// 原盤ISO内のアーカイブから1ファイルぶんのバイト列を切り出す。
// songmapの`files[]`が持つ`archive`・`offset`・`size`をそのまま渡す。
//
// 実行: deno run --allow-read=. --allow-write=<out dir> \
//   packages/utils/video_tools/slice_iso_file.ts \
//   <世代> <archive> <offset> <size> <out>

import { SEC } from "@csa/core";
import { openGenerationIso, readDiscFolders } from "@csa/containers-disc";
import { parseSliceIsoFileArgs } from "./cli_args.ts";
import { openSliceOutput } from "./slice_iso_gateway.ts";

// ISO内のアーカイブから切り出す範囲の検査と、読み出しの分割。副作用は持たない。

/** 1回に読み出す大きさ */
export const SLICE_CHUNK = 16 * 1024 * 1024;

export function assertSliceInRange(
  archiveName: string,
  archiveSize: number,
  offset: number,
  size: number,
): void {
  if (offset + size > archiveSize) {
    throw new Error(`${archiveName}の範囲外`);
  }
}

/** `size`バイトを`chunk`ずつに分けた、切り出しの先頭からの位置と長さ */
export const sliceChunks = (
  size: number,
  chunk: number = SLICE_CHUNK,
): { length: number; offset: number }[] =>
  Array.from({ length: Math.ceil(size / chunk) }, (_, at) => ({
    length: Math.min(chunk, size - at * chunk),
    offset: at * chunk,
  }));

export async function sliceIsoFile(
  generation: string,
  archiveName: string,
  offset: number,
  size: number,
  outputPath: string,
): Promise<void> {
  using disc = await openGenerationIso(readDiscFolders(), generation);
  using output = await openSliceOutput(outputPath);
  const archive = (await disc.collectFiles()).get(archiveName.toUpperCase());
  if (!archive) {
    throw new Error(`ISOに${archiveName}が無い`);
  }
  assertSliceInRange(archiveName, archive.size, offset, size);
  for (const chunk of sliceChunks(size)) {
    await output.write(
      await disc.readAt(
        archive.lba * SEC + offset + chunk.offset,
        chunk.length,
      ),
    );
  }
  console.log(`${archiveName}+${offset} ${size} bytes -> ${outputPath}`);
}

if (import.meta.main) {
  const args = parseSliceIsoFileArgs(Deno.args);
  await sliceIsoFile(
    args.generation,
    args.archiveName,
    args.offset,
    args.size,
    args.outputPath,
  );
}
