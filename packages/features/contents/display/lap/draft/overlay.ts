// 素材世代の曲DBエントリから、曲名カードと曲中オーバーレイ(`.if`)の参照をTOCで解き、manifest形式にする。
// 3rd〜8thは主アーカイブの`IFs`を1本示すだけなので、`legacy_overlay.ts`が扱う。
// PB形式へ組み直すのは `layout/display_prepare/lap/overlay/prepare.ts` である。

import type {
  ManifestOverlay,
  ManifestSongDraft,
  ManifestTitleCard,
  SongOverlay,
} from "@csa/core";
import {
  type DisplayLayout,
  displayLayout,
  hasDisplayAssets,
  readTitleCardPairs,
  readTitleCardTocIndex,
  SOURCE_DATA1_ARCHIVE,
} from "../../layout/mod.ts";
import { legacyOverlay } from "./legacy_overlay.ts";
import type { DraftOverlayPorts, DraftSource, SourceToc } from "./ports.ts";

/** 素材世代のDATA1のTOC。位置と件数は、表示の配置が決める */
const sourceToc = (
  ports: DraftOverlayPorts,
  elf: Uint8Array,
  layout: DisplayLayout,
): SourceToc => ({
  archive: SOURCE_DATA1_ARCHIVE,
  count: layout.data1TocCount,
  rowOf: (fileIndex) =>
    ports.tocRowOf(elf, layout.data1TocFileOffset, fileIndex),
});

/** 曲名カードの配置が分かる世代だけ、素材エントリから参照を作る。分からない世代は`undefined`を返す */
export function titleCardOf(
  ports: DraftOverlayPorts,
  row: ManifestSongDraft,
  source: DraftSource,
): ManifestTitleCard | undefined {
  if (!hasDisplayAssets(row.sourceGeneration)) {
    return undefined;
  }
  const layout = displayLayout(row.sourceGeneration);
  const artwork = ports.artworkOf(row.sourceGeneration);
  const entryOffset = ports.entryOffsetOf(
    row.sourceGeneration,
    source.elf,
    row.sourceSongIndex,
  );
  const main = readTitleCardTocIndex(source.elf, entryOffset, layout, artwork);
  return ports.titleCardOf(
    {
      anotherSprite: row.anotherTitleCardSprite ?? null,
      generation: row.sourceGeneration,
      songIndex: row.sourceSongIndex,
    },
    main,
    readTitleCardPairs(source.elf, entryOffset, artwork),
    sourceToc(ports, source.elf, layout),
  );
}

/** 曲の素材の世代の曲DBエントリから、オーバーレイのパッケージ番号と枚数を読む。曲リストはこの値を表示する */
export function sourceOverlayOf(
  ports: DraftOverlayPorts,
  { sourceGeneration: generation, sourceSongIndex: songId }: ManifestSongDraft,
  { elf, legacy }: DraftSource,
): SongOverlay {
  const overlay = ports.readSongOverlay(
    generation,
    ports.entryBytesOf(generation, elf, songId),
  );
  if (legacy === null) {
    return overlay;
  }
  const file = legacy.filesOf(songId);
  return { ...overlay, packages: file === null ? [] : [file.serial] };
}

/**
 * オーバーレイを持たない曲は`undefined`を返す。
 * `entry`はPB形式の曲DBエントリで、3rd〜8thの曲ではBPM欄だけを読む
 */
export function overlayOf(
  ports: DraftOverlayPorts,
  row: ManifestSongDraft,
  source: DraftSource,
  entry: Uint8Array,
): ManifestOverlay | undefined {
  if (ports.isLegacyOverlay(row.sourceGeneration)) {
    const bpm = ports.bpmOfEntry(entry.slice());
    if (bpm === null) {
      throw new Error("PB形式の曲DBエントリにBPM欄が無い");
    }
    return legacyOverlay(ports, row, source, bpm);
  }
  if (!hasDisplayAssets(row.sourceGeneration)) {
    return undefined;
  }
  const fields = ports.sheetFieldsOf(
    row.sourceGeneration,
    source.elf,
    ports.entryOffsetOf(row.sourceGeneration, source.elf, row.sourceSongIndex),
  );
  if (fields === undefined) {
    return undefined;
  }
  return ports.sheetOverlayOf(
    `${row.sourceGeneration} song${row.sourceSongIndex}`,
    fields,
    sourceToc(ports, source.elf, displayLayout(row.sourceGeneration)),
  );
}
