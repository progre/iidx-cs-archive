// legacy(3rd〜8th)の曲名カードを周回で書き、manifestの参照をそのファイルへ向ける。
// 曲名カード欄がカードを指していない曲は、組まない。

import { type DisplaySong, generatedSourceArchive } from "@csa/core";
import { withLegacyTitleCard } from "../../legacy_songs.ts";
import type { DisplayLapPorts, DisplayLapTypes } from "../ports.ts";

/** 返す`files`には、置いた`.if`を入れる */
export function prepareLegacyTitleCards<
  T extends DisplayLapTypes,
  M extends { songs: DisplaySong[] },
>(
  ports: Pick<DisplayLapPorts<T>, "openLegacyCardWriter">,
  manifest: M,
  generation: string,
  elf: T["elf"],
  discsDirectory: string,
): { files: string[]; manifest: M } {
  const write = ports.openLegacyCardWriter(generation, elf, discsDirectory);
  // 全曲リストで同じ曲を2行に書いた曲は、カードを1回だけ組む
  const written = new Map<number, { path: string; size: number }>();
  const cardOf = (index: number) => {
    const found = written.get(index);
    if (found !== undefined) {
      return found;
    }
    const card = write(index);
    if (card !== null) {
      written.set(index, card);
    }
    return card;
  };
  const songs = manifest.songs.map((song) => {
    const card = cardOf(song.sourceSongIndex);
    return card === null ? song : withLegacyTitleCard(song, {
      archive: generatedSourceArchive("file", card.path),
      size: card.size,
    });
  });
  const files = [...written.values()].map((card) => card.path);
  return { files, manifest: { ...manifest, songs } };
}
