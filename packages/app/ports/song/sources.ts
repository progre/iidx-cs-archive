// 全曲リストの処理と legacy の表示の処理へ、世代の曲DBと定義を渡す。

import {
  type Generation,
  type LegacyOverlay,
  openLegacyGenerationOf,
  readLegacyOverlayOf,
} from "@csa/contents-display";
import {
  type LegacyOverlayFile,
  legacyOverlayFilesOfElf,
} from "@csa/contents-file-table";
import { elfDefinitionOf, fiveKeyOf } from "@csa/selection-definitions";
import { titleKeyOf } from "@csa/selection-manifest";
import { songCatalog } from "@csa/selection-song-catalog";
import { openSongDb, songmapOfGeneration } from "./song_db.ts";

export const {
  catalogCopiesOf,
  catalogFiveKeys,
  catalogRowAt,
  catalogRowsOf,
  catalogVariants,
  groupedCatalogs,
} = songCatalog<Uint8Array>({
  fiveKeyOf,
  songsOf: (generation, elf) => openSongDb(generation, elf).songTitles(),
  titleKeyOf,
});

/** 素材ELFは呼び出し側が持つ。配置器はmanifestが指すELFを渡す */
export const openGeneration = (gen: string, elf: Uint8Array): Generation =>
  openLegacyGenerationOf(
    gen,
    elf,
    openSongDb(gen, elf),
    songmapOfGeneration(gen, elf).songs,
  );

export const openLegacyOverlay = (
  generation: string,
  elf: Uint8Array,
): LegacyOverlay =>
  readLegacyOverlayOf(
    generation,
    elf,
    elfDefinitionOf(generation).songDbRecordLayout.overlay.slots,
    openSongDb(generation, elf),
  );

/** 3rd〜8thの曲が使う`IFs`を、ELFのファイル表から引く */
export const legacyOverlayFiles = (
  generation: string,
  elf: Uint8Array,
): (songId: number) => LegacyOverlayFile | null =>
  legacyOverlayFilesOfElf(
    openSongDb(generation, elf),
    elf,
    elfDefinitionOf(generation),
  );
