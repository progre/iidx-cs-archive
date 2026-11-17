/**
 * 収録内容をELFへ書く。ABC表・曲DB・DATA1・画像セットの順に当てる。
 * 曲DBは範囲を写してから欄を重ねるので、この順序は変えられない。
 */

import type { MutableElf } from "../../elf/mod.ts";
import type { AssetPlacement, SongContent } from "../../model/mod.ts";
import type { SegmentLayout } from "../segment/mod.ts";
import {
  legacyTagOf,
  OFFSET_MASK,
  TAG_ABSOLUTE,
  TAG_SHIFT,
  verifyAbcTable,
  writeAbcTable,
} from "./abc.ts";
import { verifyData1, writeData1 } from "./data1.ts";
import { verifySongEntries, writeSongEntries } from "./entries.ts";
import { verifyImageSets, writeImageSets } from "./image_sets.ts";
import type { CsaSongDb, EntryFormat } from "./song_db.ts";

export { legacyTagOf, OFFSET_MASK, TAG_ABSOLUTE, TAG_SHIFT };
export {
  type Data1TocRow,
  data1TocRow,
  PB_TOC_COUNT,
  PB_TOC_FILE_OFFSET,
} from "./data1_toc.ts";
export type { CsaSongDb, EntryFormat } from "./song_db.ts";
export { applyFiveKeyFields, type FiveKeyFieldsSource } from "./copied/mod.ts";
export { verifyBeginnerList, writeBeginnerList } from "./beginner_list.ts";
export {
  pbVersion,
  pbVersionsOf,
  withPbVersion,
  writeVersionFolder,
} from "./version_folder.ts";

const data1TablesOf = (layout: SegmentLayout) => ({
  pointers: layout.vaddr.data1Pointers,
  toc: layout.vaddr.data1Toc,
});

/** 移した曲DBの先頭と、エントリーの形 */
export const ubSongDbOf = (
  layout: SegmentLayout,
  format: EntryFormat,
): CsaSongDb => ({ format, vaddr: layout.vaddr.songDb });

export function writeContent(
  elf: MutableElf,
  layout: SegmentLayout,
  songDb: CsaSongDb,
  content: SongContent,
  placement: AssetPlacement,
): void {
  const tables = data1TablesOf(layout);
  writeAbcTable(elf, layout.vaddr.abc, placement.abcEntries);
  writeSongEntries(elf, songDb, content);
  writeData1(elf, tables, songDb, content, placement);
  writeImageSets(elf, tables, songDb, content, placement.imageSets);
}

export function verifyContent(
  elf: MutableElf,
  layout: SegmentLayout,
  songDb: CsaSongDb,
  content: SongContent,
  placement: AssetPlacement,
): void {
  const tables = data1TablesOf(layout);
  verifyAbcTable(elf, layout.vaddr.abc, placement.abcEntries);
  verifySongEntries(elf, songDb, content);
  verifyData1(elf, tables, songDb, content, placement);
  verifyImageSets(elf, tables, songDb, content, placement.imageSets);
}
export { entryAddressOf } from "./song_db.ts";
