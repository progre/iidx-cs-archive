// 曲ごとの`.if`と、曲が指す共有画像セットを、1本につき1フォルダーへ展開する。
// legacyのELF埋め込みtileは、世代ごとに1つのフォルダーへ書く。
// 1本の失敗で止めず、失敗した本を標準エラーへ出して続ける。

import { join } from "@std/path";
import { type Disc, readSegment } from "@csa/containers-disc";
import type { FileEntry, FileTable } from "@csa/contents-file-table";
import { songFileNameOf, sourceNameOf } from "../song.ts";
import type { GenerationImage } from "../images.ts";
import type { Song } from "../song.ts";
import { data1EntryOf, type Data1Toc, data1TocOf } from "./data1.ts";
import { LegacyTables } from "./legacy_tables.ts";
import { expandIf } from "./expand_if.ts";
import type { EmbeddedTileDump } from "./embedded_tiles.ts";
import { expandIfs } from "./expand_ifs.ts";
import { imageSetIndicesOf, type SongIf, songIfsOf } from "./if_files.ts";

type Expand = (dir: string, bytes: Uint8Array) => Promise<void>;

interface IfOutput {
  /** 失敗を報告するときの見出し */
  label: string;
  /** 展開先のフォルダー名 */
  name: string;
  entry: FileEntry;
  expand: Expand;
}

/** DATA1の`.if`はPB形式、3rd〜8thは`IFs`で、曲の表を辿って色を付ける */
function expanderOf(
  toc: Data1Toc | null,
  legacy: LegacyTables | null,
  song: Song,
): Expand {
  if (toc != null) {
    return (dir, bytes) => expandIf(dir, bytes, toc.descriptorStart);
  }
  if (legacy == null) {
    throw new Error("DATA1もlegacyの表も持たない世代");
  }
  return (dir, bytes) => expandIfs(dir, bytes, legacy, song.record);
}

/** 曲中オーバーレイは一覧の先頭に並ぶので、並びの位置をそのまま番号にする */
function songOutputsOf(
  generation: string,
  song: Song,
  files: SongIf[],
  expand: Expand,
): IfOutput[] {
  const base = songFileNameOf(generation, song.index, song.record.title.text);
  return files.map(({ use, entry }, i) => {
    const kind = use === "overlay" ? `overlay${i}` : use;
    return {
      label: `${generation} record${song.index} ${kind}`,
      name: `${base}_${kind}_${sourceNameOf(entry)}`,
      entry,
      expand,
    };
  });
}

function reportAndSkip(label: string, cause: unknown): [] {
  console.error(new Error(label, { cause }));
  return [];
}

function imageSetOutputsOf(
  generation: string,
  elf: Uint8Array,
  toc: Data1Toc,
  songs: Song[],
): IfOutput[] {
  const indices = new Set(
    songs.flatMap(({ record }) => imageSetIndicesOf(record)),
  );
  const expand: Expand = (dir, bytes) =>
    expandIf(dir, bytes, toc.descriptorStart);
  return [...indices].sort((a, b) => a - b).flatMap((index) => {
    const label = `${generation} image_set ${index}`;
    try {
      const entry = data1EntryOf(elf, toc, index);
      const name = `${generation}_image_set_${sourceNameOf(entry)}`;
      return [{ label, name, entry, expand }];
    } catch (cause) {
      return reportAndSkip(label, cause);
    }
  });
}

export async function dumpIfs(
  out: string,
  disc: Disc,
  image: GenerationImage,
  elf: Uint8Array,
  songs: Song[],
  table: FileTable,
  embedded: EmbeddedTileDump,
) {
  const { generation, elf: def } = image.definition;
  const toc = data1TocOf(generation);
  const legacy = toc == null ? LegacyTables.open(generation, elf) : null;
  const songOutputs = songs.flatMap((song) => {
    try {
      const files = songIfsOf(song.record, elf, def, table, toc);
      const expand = expanderOf(toc, legacy, song);
      return songOutputsOf(generation, song, files, expand);
    } catch (cause) {
      return reportAndSkip(`${generation} record${song.index}`, cause);
    }
  });
  const imageSets = toc == null
    ? []
    : imageSetOutputsOf(generation, elf, toc, songs);
  for (const { label, name, entry, expand } of [...songOutputs, ...imageSets]) {
    try {
      await expand(join(out, name), await readSegment(disc, entry));
    } catch (cause) {
      reportAndSkip(label, cause);
    }
  }
  if (legacy == null) {
    return;
  }
  try {
    await embedded.dump(generation, songs, legacy);
  } catch (cause) {
    reportAndSkip(`${generation} tile_elf`, cause);
  }
}
