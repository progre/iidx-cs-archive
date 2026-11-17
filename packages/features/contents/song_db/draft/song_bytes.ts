// 周回で、世代の曲DBから、作品番号とムービーの差し替えに使う曲ごとのバイトを読んでおく。
// 周回の後は、ELFを読まずにここから引く。
// 作品番号の規則は索引の全曲を見るので、songmapの全曲を読む。PBも読む。

import type { ElfDefinition, SongmapDoc } from "@csa/core";
import { SongDb } from "../song_db.ts";
import { versionByteOf } from "../version/mod.ts";

interface SongBytes {
  newOld: number | undefined;
  version: number | undefined;
  videoFlags: number;
}

export class LapSongBytes {
  readonly #bytes = new Map<string, SongBytes>();
  readonly #definitionOf: (generation: string) => ElfDefinition;

  constructor(definitionOf: (generation: string) => ElfDefinition) {
    this.#definitionOf = definitionOf;
  }

  record(generation: string, elf: Uint8Array, songmap: SongmapDoc): void {
    const definition = this.#definitionOf(generation);
    const origin = definition.songDbRecordLayout.selection.origin;
    const db = new SongDb(elf, definition);
    for (const { song_id: songId } of songmap.songs) {
      const record = db.record(songId);
      const byte = origin === null ? undefined : versionByteOf(record);
      this.#bytes.set(generation + "/" + songId, {
        newOld: origin?.isVersion === false ? byte : undefined,
        version: origin?.isVersion === true ? byte : undefined,
        videoFlags: record.video.unkPb62 ?? 0,
      });
    }
  }

  #of(generation: string, songId: number): SongBytes {
    const found = this.#bytes.get(generation + "/" + songId);
    if (found === undefined) {
      throw new Error(
        `${generation} song${songId}のバイトを周回で読んでいない`,
      );
    }
    return found;
  }

  newOldAt = (generation: string, songId: number): number | undefined =>
    this.#of(generation, songId).newOld;

  versionAt = (generation: string, songId: number): number | undefined =>
    this.#of(generation, songId).version;

  videoFlagsOf = (generation: string, songId: number): number =>
    this.#of(generation, songId).videoFlags;
}
