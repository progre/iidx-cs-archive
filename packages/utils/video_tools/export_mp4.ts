// convert.tsの出力PSSを目視レビュー用に1フォルダーへmp4化する。映像は再圧縮せず容器だけ替える。
// ファイル名は <作品>_<index>_<曲名>.mp4。曲名は隣の.jsonから取る。
//
// 実行: deno run --allow-read=<pss dir> --allow-write=<out dir> --allow-run=ffmpeg \
//   packages/utils/video_tools/export_mp4.ts <pss dir> <out dir>

import { metaPathOf, mp4JobOf } from "@csa/selection-video-era1";
import { parseExportMp4Args } from "./cli_args.ts";
import { runFfmpeg } from "@csa/contents-video";
import {
  listPssEntries,
  makeDirectory,
  readTitle,
} from "./export_mp4_gateway.ts";

export async function exportMp4(pssDir: string, outDir: string): Promise<void> {
  makeDirectory(outDir);
  let count = 0;
  for (const { directory, fileName, generation } of listPssEntries(pssDir)) {
    const title = readTitle(metaPathOf(directory, fileName));
    await runFfmpeg(
      mp4JobOf(outDir, generation, directory, fileName, title).args,
    );
    count++;
  }
  console.log(`${outDir}: ${count} files`);
}

if (import.meta.main) {
  const { outDir, pssDir } = parseExportMp4Args(Deno.args);
  await exportMp4(pssDir, outDir);
}
