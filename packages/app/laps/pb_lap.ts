// PBの周回。PB原盤の曲を読み、原盤は閉じずに返す。

import type { SongmapDoc } from "@csa/core";
import { catalogRowsOf, readPbSongs } from "../ports/song/mod.ts";
import { assertNoPbExclusion } from "@csa/selection-manifest";
import { type Disc, type DiscInfo, PbSource } from "@csa/containers-disc";
import { PB_GENERATION } from "@csa/selection-definitions";
import type { GenerationLap } from "./generation_lap.ts";

/** PBの原盤は、ISOの書き込みと検証の終わりまで開いておく。結果の`pb`を受け取った側が閉じる */
export async function pbLapOf(
  opened: Disc,
  { elf, songmap }: { elf: Uint8Array; songmap: SongmapDoc },
  info: DiscInfo,
): Promise<Omit<GenerationLap, "lz">> {
  const catalogRows = catalogRowsOf(PB_GENERATION, elf);
  assertNoPbExclusion(catalogRows);
  const pb = new PbSource(opened.disc, info);
  const songs = await readPbSongs(elf, songmap, pb);
  return {
    // PB原盤の曲にも、全曲リストに書いた難易度を書く
    catalogRows,
    generation: PB_GENERATION,
    info,
    pb,
    ...songs,
    rows: [],
    songmap,
  };
}
