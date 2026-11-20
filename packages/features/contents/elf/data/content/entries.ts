/**
 * 曲DBの枠へ収録内容を書く。
 * 裏エントリーの枠には複製元が無いので、差し替え元の枠を写してから素材の範囲を重ねる。
 * 写さない欄が未初期化のまま残るのを防ぐため、この順序は変えられない。
 * 差し替え元は書き終えた枠を写すので、manifestの並びによらず、表の曲をすべて書いてから裏の曲を書く。
 */

import type { MutableElf } from "../../elf/mod.ts";
import { PB_SONG_COUNT, type SongContent } from "../../model/mod.ts";
import { pbVersionsOf, withPbVersion } from "./version_folder.ts";
import {
  applyFiveKeyFields,
  copiedFieldAddresses,
  fiveKeyRangesOf,
  frontFillLevelAddresses,
  verifyChartMoves,
  writeChartMoves,
} from "./copied/mod.ts";
import {
  type CsaSongDb,
  entryAddressOf,
  layoutOf,
  placeholderFieldsOf,
  VIDEO_FLAG_BITS,
  videoFlagsOffsetOf,
} from "./song_db.ts";

/** PBの曲のムービー欄と映し方の印、レベル欄のオフセット */
function pbFieldsOf({ format }: CsaSongDb) {
  const { selection, video } = layoutOf(format);
  return {
    flags: videoFlagsOffsetOf(format),
    levels: selection.levels.offset,
    video: video.primary.offset,
  };
}

export function writeSongEntries(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
): void {
  const entryAt = (index: number) => entryAddressOf(songDb, index);
  const entrySize = songDb.format.definition.songDbRecordLength;
  const pb = pbFieldsOf(songDb);
  const songOf = new Map(
    content.songs.map((song) => [song.targetSongIndex, song.entry]),
  );
  const folders = pbVersionsOf(content);
  // PB原盤の曲は manifest に無いので、枠にある原盤のエントリーを使う
  const frontEntryOf = (index: number) =>
    songOf.get(index) ??
      (index < PB_SONG_COUNT
        ? withPbVersion(
          songDb.format,
          elf.slice(entryAt(index), entrySize),
          index,
          folders,
        )
        : undefined);
  // PB 原盤の曲の写しの裏は、表の曲を PB の枠に書く前のエントリーを使う
  const pbOriginals = (content.pbBacks ?? []).map((back) =>
    [
      back,
      withPbVersion(
        songDb.format,
        elf.slice(entryAt(back.songId), entrySize),
        back.songId,
        folders,
      ),
    ] as const
  );
  const frontsFirst = [
    ...content.songs.filter((song) => song.variantOf === undefined),
    ...content.songs.filter((song) => song.variantOf !== undefined),
  ];
  for (const song of frontsFirst) {
    const target = entryAt(song.targetSongIndex);
    if (song.variantOf !== undefined) {
      elf.setBytes(
        target,
        elf.slice(entryAt(song.variantOf.targetSongIndex), entrySize),
      );
    }
    for (const [start, end] of song.entryRanges) {
      elf.setBytes(target + start, song.entry.subarray(start, end));
    }
    if (song.fiveKeyFrontIndex !== undefined) {
      const front = frontEntryOf(song.fiveKeyFrontIndex);
      if (front === undefined) {
        throw new Error(`5鍵盤版の表が無い: ${song.fiveKeyFrontIndex}`);
      }
      const ownLevels = song.fiveKeyOwnLevels === true;
      const shown = applyFiveKeyFields(
        songDb.format,
        song,
        front,
        ownLevels,
      );
      for (const [start, end] of fiveKeyRangesOf(songDb.format, ownLevels)) {
        elf.setBytes(target + start, shown.subarray(start, end));
      }
    }
    for (const reference of song.abcReferences) {
      const address = target + reference.fieldOffset;
      if (reference.width === "u16") {
        elf.setU16(address, reference.newAbcIndex);
      } else {
        elf.setU32(address, reference.newAbcIndex);
      }
    }
    if (song.videoFields.length === 0) continue;
    if (content.sharedVideoAbcIndex === undefined) {
      throw new Error("共有動画の欄があるのにABC indexが無い");
    }
    for (const fieldOffset of song.videoFields) {
      elf.setU32(target + fieldOffset, content.sharedVideoAbcIndex);
    }
  }
  // 曲を置かない枠には複製した曲が残るので、譜面の無いplaceholderのエントリーにする
  for (const index of content.vacantSlots ?? []) {
    for (const { bytes, offset } of placeholderFieldsOf(songDb.format)) {
      elf.setBytes(entryAt(index) + offset, new Uint8Array(bytes));
    }
  }
  for (const [back, entry] of pbOriginals) {
    if (!songOf.has(back.songId)) {
      throw new Error(`PB原盤のsong${back.songId}の枠に表の曲が無い`);
    }
    elf.setBytes(entryAt(back.targetSongIndex), entry);
  }
  for (const pbVideo of content.pbVideos ?? []) {
    const target = entryAt(pbVideo.songIndex);
    const flags = elf.slice(target + pb.flags, 1)[0];
    elf.setU32(target + pb.video, pbVideo.abcIndex);
    elf.setBytes(
      target + pb.flags,
      Uint8Array.of((flags & ~VIDEO_FLAG_BITS) | pbVideo.flags),
    );
  }
  for (const pbLevel of content.pbLevels ?? []) {
    elf.setBytes(entryAt(pbLevel.songIndex) + pb.levels, pbLevel.levels);
  }
  // PB原盤の曲のレベル欄を書いた後でないと、表の曲へ写したレベルが消える
  writeChartMoves(elf, songDb, content);
}

/** 曲DBの資産参照欄が新しいABC indexを指しているかを見る。 */
export function verifySongEntries(
  elf: MutableElf,
  songDb: CsaSongDb,
  content: SongContent,
): void {
  const pb = pbFieldsOf(songDb);
  const copiedFields = copiedFieldAddresses(songDb, content);
  for (const song of content.songs) {
    const target = entryAddressOf(songDb, song.targetSongIndex);
    for (const reference of song.abcReferences) {
      const address = target + reference.fieldOffset;
      if (copiedFields.has(address)) {
        continue;
      }
      const actual = reference.width === "u16"
        ? elf.u16(address)
        : elf.u32(address);
      if (actual !== reference.newAbcIndex) {
        throw new Error(
          `song${song.targetSongIndex}の資産参照が読み戻せない: ` +
            `0x${reference.fieldOffset.toString(16)}`,
        );
      }
    }
  }
  for (const pbVideo of content.pbVideos ?? []) {
    const target = entryAddressOf(songDb, pbVideo.songIndex);
    const flags = elf.slice(target + pb.flags, 1)[0];
    if (
      elf.u32(target + pb.video) !== pbVideo.abcIndex ||
      (flags & VIDEO_FLAG_BITS) !== pbVideo.flags
    ) {
      throw new Error(`PBのsong${pbVideo.songIndex}のムービー欄が読み戻せない`);
    }
  }
  const copied = frontFillLevelAddresses(songDb, content);
  for (const pbLevel of content.pbLevels ?? []) {
    const target = entryAddressOf(songDb, pbLevel.songIndex) + pb.levels;
    const actual = elf.slice(target, pbLevel.levels.length);
    const same = actual.every((byte, i) =>
      copied.has(target + i) || byte === pbLevel.levels[i]
    );
    if (!same) {
      throw new Error(`PBのsong${pbLevel.songIndex}のレベル欄が読み戻せない`);
    }
  }
  verifyChartMoves(elf, songDb, content);
}
