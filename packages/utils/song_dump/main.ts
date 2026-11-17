// ISOのELFにある曲DBから、全世代の題名を「世代,題名,完全な題名」の行で出す。
// --outを付けると、各曲のムービーをmkvで、各曲の`.if`を展開して<出力先>へ書き出す。
// mkvは<世代>_video_<アーカイブ>_<番号>.mkv。中身が同じムービーは最初の1本だけを書き、
// 曲とmkvの対応はvideos.csvに書く。
// `.if`は、9th以降・US・PBでは曲中オーバーレイと曲名カード、3rd〜8thでは曲中オーバーレイの`IFs`。
// 曲が指す共有画像セットは世代ごとに1回だけ展開する。CSAのISOは扱わない。
// --titleを付けると、題名が一致する曲だけを扱う。大文字と小文字は区別しない。
//
// 実行: deno run --allow-read=. --allow-write=<出力先> --allow-run=ffmpeg \
//   packages/utils/song_dump/main.ts \
//   --iso <ISOフォルダー> [--out <出力先>] [--title <題名>]
//
// `.if`は1本につき1フォルダーへ展開する。フォルダー名は
// <世代>_<曲DB index>_<題名>_<用途>_<アーカイブ>_<番号>、共有画像セットは
// <世代>_image_set_data1_<番号>。中身は次のとおり。
// - `.if`: sheet<i>.png、metadata.json(sheet・sprite・animationの表)
// - `IFs`: tile_<組>_<選択子>.png。曲のspriteがその組と選択子で塗る128x128のtileを、
//   通し番号順に8枚で折り返して並べる
// ELFに埋め込まれたlegacy tileは曲をまたいで使い回されるので、世代ごとに1回だけ、
// フォルダー<世代>_tile_elfへ同じ形のtile_<組>_<選択子>.pngで書く。
// 組と選択子ごとに、扱う曲すべてのtileを重複なく合わせる。埋め込みのtileを使う曲が
// 無い世代はフォルダーを作らない。どの曲がどの組と選択子を使うかはembedded_tiles.csvに書く。

import { parseArgs } from "@std/cli/parse-args";
import { type Disc, openIso9660File } from "@csa/containers-disc";
import { FileTable } from "@csa/contents-file-table";
import { SongDb } from "@csa/contents-song-db";
import { SEC } from "@csa/core";
import { dumpIfs, EmbeddedTileDump } from "./if/mod.ts";
import { eachGenerationIsos, type GenerationImage } from "./images.ts";
import { type Song, songsOf } from "./song.ts";
import { VideoDump } from "./video_dump.ts";

interface Options {
  iso: string;
  out: string | null;
  title: string | null;
}

function parseOptions(rawArgs: string[]): Options {
  const args = parseArgs(rawArgs, { string: ["iso", "out", "title"] });
  if (args.iso == null) {
    throw new Error("--iso <ISOフォルダー> を指定する");
  }
  return { iso: args.iso, out: args.out ?? null, title: args.title ?? null };
}

async function readElf(disc: Disc, image: GenerationImage) {
  const fileName = image.definition.elf.fileName.toUpperCase();
  const elf = disc.files.get(fileName);
  if (elf == null) {
    throw new Error(`ELFが無い: ${image.path} ${fileName}`);
  }
  return await disc.disc.readAt(elf.lba * SEC, elf.size);
}

function lineOf(generation: string, { index, record }: Song) {
  try {
    const { text, full } = record.title;
    return `${generation},${text},${full ?? ""}`;
  } catch (cause) {
    throw new Error(`${generation} record${index}`, { cause });
  }
}

async function dumpImage(
  image: GenerationImage,
  options: Options,
  videos: VideoDump | null,
  embedded: EmbeddedTileDump | null,
) {
  using iso = await openIso9660File(image.path);
  const disc = { disc: iso, files: await iso.collectFiles() };
  const elf = await readElf(disc, image);
  const songs = songsOf(new SongDb(elf, image.definition.elf), options.title);
  const generation = image.definition.generation;
  songs
    .map((song) => lineOf(generation, song))
    .forEach((line) => console.log(line));
  if (options.out != null && videos != null && embedded != null) {
    const table = new FileTable(elf, image.definition.elf.fileTable);
    await videos.dump(disc, image, songs, table);
    await dumpIfs(options.out, disc, image, elf, songs, table, embedded);
  }
}

async function main() {
  const options = parseOptions(Deno.args);
  if (options.out != null) {
    await Deno.mkdir(options.out, { recursive: true });
  }
  const videos = options.out == null ? null : new VideoDump(options.out);
  const embedded = options.out == null
    ? null
    : new EmbeddedTileDump(options.out);
  for (const image of await eachGenerationIsos(options.iso)) {
    await dumpImage(image, options, videos, embedded);
  }
  await videos?.writeIndex();
  await embedded?.writeIndex();
}

if (import.meta.main) {
  await main();
}
