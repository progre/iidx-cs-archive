// 曲のムービーをmkvで書き出す。中身が同じムービーは世代をまたいで1本だけ書き、
// どの曲がどのmkvを使うかをvideos.csvへ書く。

import { stringify } from "@std/csv";
import { join } from "@std/path";
import { type Disc, readSegment } from "@csa/containers-disc";
import { type FileTable, videoFilesOf } from "@csa/contents-file-table";
import { writeMkv } from "@csa/contents-mkv";
import { sourceNameOf } from "./song.ts";
import type { GenerationImage } from "./images.ts";
import type { Song } from "./song.ts";

const COLUMNS = ["generation", "index", "title", "slot", "mkv"];

/** 世代によって末尾のセクターのパディングの長さが違うので、末尾のゼロを除いて比べる */
async function contentKeyOf(mpeg: Uint8Array): Promise<string> {
  let end = mpeg.length;
  while (end > 0 && mpeg[end - 1] === 0) {
    end--;
  }
  const digest = await crypto.subtle.digest("SHA-256", mpeg.slice(0, end));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export class VideoDump {
  /** ムービーの中身のハッシュから、書き出したmkvの名前を引く */
  private readonly written = new Map<string, string>();
  private readonly rows: Record<string, string | number>[] = [];

  constructor(private readonly out: string) {}

  /** 1本の失敗で止めず、失敗した本を標準エラーへ出して続ける */
  async dump(
    disc: Disc,
    image: GenerationImage,
    songs: Song[],
    table: FileTable,
  ) {
    const { generation, elf } = image.definition;
    const layout = elf.songDbRecordLayout.video;
    const files = songs.flatMap(({ index, record }) => {
      try {
        return videoFilesOf(record, layout, table)
          .map((file) => ({ ...file, index, title: record.title.text }));
      } catch (cause) {
        console.error(new Error(`${generation} record${index}`, { cause }));
        return [];
      }
    });
    for (const { index, title, slot, entry } of files) {
      try {
        const mpeg = await readSegment(disc, entry);
        const mkv = await this.write(
          mpeg,
          `${generation}_video_${sourceNameOf(entry)}.mkv`,
        );
        this.rows.push({ generation, index, title, slot, mkv });
      } catch (cause) {
        const label = `${generation} record${index} video${slot}`;
        console.error(new Error(label, { cause }));
      }
    }
  }

  async writeIndex() {
    const csv = stringify(this.rows, { columns: COLUMNS });
    await Deno.writeTextFile(join(this.out, "videos.csv"), csv);
  }

  /** 中身が同じムービーを書き出し済みなら、書かずにその名前を返す */
  private async write(mpeg: Uint8Array, name: string): Promise<string> {
    const key = await contentKeyOf(mpeg);
    const existing = this.written.get(key);
    if (existing != null) {
      return existing;
    }
    await writeMkv(mpeg, join(this.out, name));
    this.written.set(key, name);
    return name;
  }
}
