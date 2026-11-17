/**
 * 原盤のELFと収録内容からCSAのELFを作る。
 */

import { createHash } from "node:crypto";
import { type InstructionPatch, MutableElf } from "./elf/mod.ts";
import {
  type CsaSongDb,
  pbVersionsOf,
  ubSongDbOf,
  verifyBeginnerList,
  verifyContent,
  writeBeginnerList,
  writeContent,
  writeVersionFolder,
} from "./data/content/mod.ts";
import {
  applyHeapGuard,
  enlargePlayBuffer,
  extendHeap,
} from "./code/heap/mod.ts";
import { buildBaseRewrite } from "./code/instructions/mod.ts";
import { buildSongValueWidth } from "./code/instructions/song_value/mod.ts";
import {
  appendSegment,
  buildSegmentBytes,
  PB_DATA1_COUNT,
  segmentLayout,
} from "./data/segment/mod.ts";
import {
  type SongDbAddress,
  verifyAddedFolder,
  verifyContentStubs,
  writeAddedFolder,
  writeBaseStubs,
  writeContentStubs,
} from "./code/stubs/mod.ts";
import {
  verifyStatisticsTotals,
  writeStatisticsTotals,
} from "./code/statistics/mod.ts";
import { verifyGhostTable, writeGhostTable } from "./code/ghost_table/mod.ts";
import type {
  AssetPlacement,
  CsaElfInput,
  ElfPatchTables,
} from "./model/mod.ts";

/** BGM差し替えのstubが、裏の曲のレベル欄を読むのに使う */
const songDbAddressOf = ({ format, vaddr }: CsaSongDb): SongDbAddress => ({
  recordLength: format.definition.songDbRecordLength,
  vaddr,
});

/** 原盤のELFのSHA-256。入力が違えばaddressの前提が崩れるので最初に照合する。 */
const PB_ELF_SHA256 =
  "3fd3fe9e98bfc496672699b45dda4fe99457357ca058992b29d430a6a7737e1d";

function assertPbElf(pbElf: Uint8Array): void {
  const digest = createHash("sha256").update(pbElf).digest("hex");
  if (digest !== PB_ELF_SHA256) {
    throw new Error("原盤のELFのハッシュが既知の値と違う: " + digest);
  }
}

function applyPatches(
  elf: MutableElf,
  patches: readonly InstructionPatch[],
): void {
  for (const patch of patches) elf.setU32(patch.address, patch.newWord);
}

/** 原盤に無い画像セット。読み込みの表へ並べる順序は配置の並びをそのまま使う。 */
const extraImageSetsOf = (placement: AssetPlacement): number[] =>
  placement.imageSets
    .map((row) => row.newData1Index)
    .filter((index) => index >= PB_DATA1_COUNT);

export function buildCsaElf(
  pbElf: Uint8Array,
  input: CsaElfInput,
  tables: ElfPatchTables,
): Uint8Array {
  assertPbElf(pbElf);
  const { capacity, content, entryFormat, placement } = input;
  const layout = segmentLayout(
    capacity,
    entryFormat.definition.songDbRecordLength,
  );
  const songDb = ubSongDbOf(layout, entryFormat);
  const elf = new MutableElf(
    appendSegment(pbElf, buildSegmentBytes(pbElf, layout, capacity)),
  );
  const base = buildBaseRewrite(elf, capacity, layout, tables);
  applyPatches(elf, base.patches);
  // 曲値16bit化は、ここまでを当てた語をstubへ預けるので後に置く
  const width = buildSongValueWidth(elf, {
    entries: capacity.records,
    itemCapacity: capacity.itemCapacity,
    precedingPatches: base.precedingPatches,
    sites: tables.songValueSites,
  });
  applyPatches(elf, width.patches);
  writeBaseStubs(elf, width.stubBytes, base.unlockBytes);
  writeContent(elf, layout, songDb, content, placement);
  writeContentStubs(
    elf,
    content,
    layout.vaddr.abc,
    extraImageSetsOf(placement),
    songDbAddressOf(songDb),
  );
  writeVersionFolder(
    elf,
    songDb,
    pbVersionsOf(content),
    new Set(content.songs.map((song) => song.targetSongIndex)),
  );
  writeStatisticsTotals(elf, songDb, content, capacity.songCount);
  writeGhostTable(elf, capacity.songCount);
  writeBeginnerList(elf);
  writeAddedFolder(elf, capacity, placement.addedFolderNames);
  applyHeapGuard(elf);
  extendHeap(elf);
  enlargePlayBuffer(elf);
  verifyCsaElf(elf, input);
  return elf.bytes;
}

/**
 * 収録内容から書いた値を読み戻す。バイト列だけを見るので、途中の計算に依らない。
 * 命令の中には、後で丸ごと差し替わるものがある。それらは確かめない。
 */
export function verifyCsaElf(elf: MutableElf, input: CsaElfInput): void {
  const { capacity, content, entryFormat, placement } = input;
  const layout = segmentLayout(
    capacity,
    entryFormat.definition.songDbRecordLength,
  );
  const songDb = ubSongDbOf(layout, entryFormat);
  verifyContent(elf, layout, songDb, content, placement);
  verifyContentStubs(
    elf,
    content,
    extraImageSetsOf(placement),
    songDbAddressOf(songDb),
  );
  verifyAddedFolder(elf, placement.addedFolderNames);
  verifyBeginnerList(elf);
  verifyStatisticsTotals(elf, songDb, content, capacity.songCount);
  verifyGhostTable(elf, capacity.songCount);
}
