// PB原盤の曲を、曲リストに載せるためにPBの周回で読む。PB原盤の曲はmanifestに載らない。
// オーバーレイの長さは`.if`の記述子が示す長さで、PBの曲DBのオーバーレイ欄が示すDATA1の番号から引く。
// オーバーレイのハッシュは、その長さまでの中身から求める。

import {
  inDiscOrder,
  inKeyOrder,
  isProgressStep,
  SEC,
  type SongmapDoc,
  type SongmapSong,
  type SongOverlay,
} from "@csa/core";
import { overlaySourceOf } from "../../data/rows/mod.ts";
import type { LapMeasurePorts } from "../../ports.ts";

export interface PbSong {
  /** 原盤のままの曲DBエントリ */
  entry: Uint8Array;
  overlay: SongOverlay;
  song: SongmapSong;
}

/** PBの原盤のうち、長さを求めるのに使う部分 */
export interface PbDisc {
  info: { files: ReadonlyMap<string, { lba: number }> };
  readAt(offset: number, length: number): Promise<Uint8Array>;
}

const pbSongsOf = (
  ports: LapMeasurePorts,
  elf: Uint8Array,
  songmap: SongmapDoc,
): PbSong[] =>
  songmap.songs.map((song) => {
    const entry = ports.pbEntryOf(elf, song.song_id);
    return { entry, overlay: ports.pbOverlayOf(entry), song };
  });

/** `overlaySourceOf`の識別子 → 長さとハッシュ */
async function pbOverlaysOf(
  ports: LapMeasurePorts,
  elf: Uint8Array,
  songs: readonly PbSong[],
  disc: PbDisc,
): Promise<{ lengths: Map<string, number>; prints: Map<string, string> }> {
  const archive = disc.info.files.get(ports.dataArchive.toUpperCase());
  if (archive === undefined) {
    throw new Error(`PBの原盤に${ports.dataArchive}が無い`);
  }
  const indices = [...new Set(songs.flatMap((song) => song.overlay.packages))];
  const rows = inDiscOrder(
    indices.map((index) => ({
      index,
      row: ports.tocRowOf(elf, ports.pbTocFileOffset, index),
    })),
    ({ row }) => row.sector,
  );
  const lengths = new Map<string, number>();
  const prints = new Map<string, string>();
  for (const [done, { index, row }] of rows.entries()) {
    if (isProgressStep(done + 1, rows.length)) {
      console.log(`${done + 1}/${rows.length} pb overlay`);
    }
    const start = (archive.lba + row.sector) * SEC;
    const source = overlaySourceOf("pb", index);
    const length = await ports.ifPayloadLength((offset, length) =>
      disc.readAt(start + offset, length)
    );
    lengths.set(source, length);
    const bytes = await disc.readAt(start, Math.min(length, row.count * SEC));
    prints.set(source, await ports.printOf(bytes));
  }
  // 曲リストは表の並びのまま書くので、読んだ順ではなく元の順に戻す
  const sources = indices.map((index) => overlaySourceOf("pb", index));
  return {
    lengths: inKeyOrder(lengths, sources),
    prints: inKeyOrder(prints, sources),
  };
}

/** PBの周回で、PB原盤の曲と、そのオーバーレイの長さとハッシュを読む */
export async function readPbSongs(
  ports: LapMeasurePorts,
  elf: Uint8Array,
  songmap: SongmapDoc,
  disc: PbDisc,
): Promise<
  {
    contentPrints: Map<string, string>;
    pbSongs: PbSong[];
    sourceLengths: Map<string, number>;
  }
> {
  const pbSongs = pbSongsOf(ports, elf, songmap);
  console.time("time pb overlay prints");
  const { lengths, prints } = await pbOverlaysOf(ports, elf, pbSongs, disc);
  console.timeEnd("time pb overlay prints");
  return { contentPrints: prints, pbSongs, sourceLengths: lengths };
}
