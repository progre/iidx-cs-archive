// era1ムービーの解像度と多重化レートを、原盤ISOの各ムービーの先頭パックから読む。
// 値はsequence_headerの幅と高さ、pack headerのmux rateで、ffmpegの測定ではない。

import { PACK_SIZE, parseHead } from "../head/mod.ts";
import type { Era1FormatPorts, Era1VideoRange } from "./ports.ts";
import {
  generatedSourceArchive,
  isProgressStep,
  type OpenDisc,
  SEC,
} from "@csa/core";
import { convertedSize } from "./convert_gateway.ts";

// era1のムービーの範囲を、開いてある原盤から読む。
/** 原盤のアーカイブの中の範囲を読む。アーカイブが無ければ例外にする */
export function videoReaderOf({ disc, files }: OpenDisc) {
  return (
    video: { archive: string; generation: string; offset: number },
    size: number,
  ): Promise<Uint8Array> => {
    const archive = files.get(video.archive.toUpperCase());
    if (archive === undefined) {
      throw new Error(video.generation + ": " + video.archive + "が無い");
    }
    return disc.readAt(archive.lba * SEC + video.offset, size);
  };
}

// 変換済みムービーのファイルを、manifestのアーカイブ名と大きさにする。
export const convertedFileOf = (
  output: string,
): { archive: string; size: number } => ({
  archive: generatedSourceArchive("file", output),
  size: convertedSize(output),
});

/**
 * 作品とファイルの組ごとに解像度と多重化レートを持つ表を、原盤から作る。
 * キーと値の書式は`ports`が決める
 */
export async function loadFormats(
  generation: string,
  videos: readonly Era1VideoRange[],
  ports: Era1FormatPorts,
): Promise<Map<string, string>> {
  const formats = new Map<string, string>();
  for (const [done, video] of videos.entries()) {
    if (isProgressStep(done + 1, videos.length)) {
      console.log(`${done + 1}/${videos.length} ${generation} movie format`);
    }
    const pack = await ports.read(video, PACK_SIZE);
    formats.set(
      ports.formatKeyOf(generation, video.key),
      ports.formatOf(parseHead(pack)),
    );
  }
  return formats;
}
