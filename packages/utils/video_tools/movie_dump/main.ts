// 全世代の原盤にあるムービーを、すべてmkvで<出力先>へ書き出す。
// songmapのファイルのうち、MPEG-PSのパックヘッダーで始まるものをムービーとみなす。
// ムービーは通し番号ごとに1本ずつ書く。曲DBが参照しないムービーと、中身が同じムービーも省かない。
// mkvの名前は<世代>_<songmapの通し番号>.mkvで、曲リストHTMLのムービー識別子と対応する。
// 1本の失敗で止めず、失敗した本を標準エラーへ出して続ける。
//
// 実行: deno run --allow-read=. --allow-write=<出力先> --allow-run=ffmpeg \
//   packages/utils/video_tools/movie_dump/main.ts --out <出力先>

import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import {
  type Disc,
  openGenerationIso,
  readDiscFolders,
  readRootFile,
  readSegment,
} from "@csa/containers-disc";
import type { SongmapDoc, SongmapFile } from "@csa/core";
import { isMpegPs, MPEG_PS_HEAD_BYTES, writeMkv } from "@csa/contents-mkv";
import {
  DEFINITIONS,
  elfFileNameOf,
  songmapRuleOf,
} from "@csa/selection-definitions";
import { songmapOf } from "@csa/contents-file-table";
import { SongDb } from "@csa/contents-song-db";

// 書き出すmkvの名前。曲リストHTMLのムービー識別子`<世代>:<songmapの通し番号>`と対応させる。
// `:`はファイル名に使えないので`_`でつなぐ。

export const movieFileNameOf = (generation: string, index: number): string =>
  `${generation}_${index}.mkv`;

// 実行ファイルから世代のsongmapを作る。
// utils は app を参照できないので、features の関数を組み合わせてここに書く。
export function songmapOfGeneration(
  generation: string,
  elf: Uint8Array,
): SongmapDoc {
  const def = DEFINITIONS.find((each) => each.generation === generation);
  if (def == null) {
    throw new Error("曲DBの定義が無い世代: " + generation);
  }
  const rule = songmapRuleOf(generation);
  const db = new SongDb(elf, def.elf);
  const records = Array.from(
    { length: rule.songCount ?? db.length },
    (_, index) => db.record(index),
  );
  return songmapOf({ elf, def: def.elf, rule, records });
}

function outOf(rawArgs: string[]): string {
  const args = parseArgs(rawArgs, { string: ["out"] });
  if (args.out == null) {
    throw new Error("--out <出力先> を指定する");
  }
  return args.out;
}

async function isMovie(disc: Disc, file: SongmapFile): Promise<boolean> {
  if (file.size < MPEG_PS_HEAD_BYTES) {
    return false;
  }
  const head = await readSegment(disc, { ...file, size: MPEG_PS_HEAD_BYTES });
  return isMpegPs(head);
}

/** 書き出した本数と失敗した本数を返す */
async function dumpGeneration(
  generation: string,
  out: string,
): Promise<{ failed: number; written: number }> {
  using iso = await openGenerationIso(readDiscFolders(), generation);
  const disc: Disc = { disc: iso, files: await iso.collectFiles() };
  const elf = await readRootFile(iso, elfFileNameOf(generation));
  const counts = { failed: 0, written: 0 };
  for (const file of songmapOfGeneration(generation, elf).files) {
    try {
      if (!await isMovie(disc, file)) {
        continue;
      }
      const mpeg = await readSegment(disc, file);
      await writeMkv(mpeg, join(out, movieFileNameOf(generation, file.index)));
      counts.written++;
    } catch (cause) {
      counts.failed++;
      console.error(new Error(`${generation}:${file.index}`, { cause }));
    }
  }
  return counts;
}

async function main() {
  const out = outOf(Deno.args);
  await Deno.mkdir(out, { recursive: true });
  for (const generation of Object.keys(readDiscFolders())) {
    const { failed, written } = await dumpGeneration(generation, out);
    console.log(`${generation}: wrote ${written}, failed ${failed}`);
  }
}

if (import.meta.main) {
  await main();
}
