/**
 * 追加セグメントの中身を組み、原盤のELFの末尾へ連ねて空のPT_LOADへ割り当てる。
 * 曲DBの余剰枠は原盤の1枠の複製で埋め、題名だけを枠ごとの識別子へ差し替える。
 */

import { PB_SONG_COUNT, type SongCapacity } from "../../model/mod.ts";
import { CANARY, SEGMENT_VADDR, type SegmentLayout } from "./layout.ts";

/** 余剰枠の複製元にする原盤の曲DBの枠。 */
const CLONE_SOURCE_INDEX = 11;
/** 複製した枠の題名。枠ごとに通し番号を付ける。 */
const CLONE_TITLE_PREFIX = "ASSET SONG ";
/** 曲DBエントリーの先頭にある題名の欄。 */
const TITLE_SIZE = 0x40;
const PT_LOAD = 1;
const PHENTSIZE = 0x20;

const align16 = (value: number) => (value + 15) & ~15;

/** 原盤のPT_LOADからvaddrをファイル位置へ直す。セグメントを足す前に使う。 */
function sourceOffsetOf(pbElf: Uint8Array, vaddr: number): number {
  const view = new DataView(pbElf.buffer, pbElf.byteOffset, pbElf.byteLength);
  const phoff = view.getUint32(0x1c, true);
  const phnum = view.getUint16(0x2c, true);
  for (let index = 0; index < phnum; index++) {
    const at = phoff + index * PHENTSIZE;
    if (view.getUint32(at, true) !== PT_LOAD) continue;
    const segmentVaddr = view.getUint32(at + 8, true);
    const fileSize = view.getUint32(at + 16, true);
    if (vaddr >= segmentVaddr && vaddr < segmentVaddr + fileSize) {
      return view.getUint32(at + 4, true) + vaddr - segmentVaddr;
    }
  }
  throw new Error(`vaddr 0x${vaddr.toString(16)}がPT_LOADに無い`);
}

function cloneSurplusSongs(
  segment: Uint8Array,
  songDbOffset: number,
  songCount: number,
  entrySize: number,
): void {
  const source = songDbOffset + CLONE_SOURCE_INDEX * entrySize;
  const encoder = new TextEncoder();
  for (let index = PB_SONG_COUNT; index < songCount; index++) {
    const destination = songDbOffset + index * entrySize;
    segment.set(
      segment.subarray(source, source + entrySize),
      destination,
    );
    const title = new Uint8Array(TITLE_SIZE);
    const serial = String(index - PB_SONG_COUNT + 1).padStart(3, "0");
    title.set(encoder.encode(CLONE_TITLE_PREFIX + serial));
    segment.set(title, destination);
  }
}

export function buildSegmentBytes(
  pbElf: Uint8Array,
  layout: SegmentLayout,
  capacity: SongCapacity,
): Uint8Array {
  const segment = new Uint8Array(layout.totalBytes).fill(CANARY);
  for (const part of layout.parts) {
    const offset = part.vaddr - SEGMENT_VADDR;
    if (part.fill !== undefined) {
      segment.fill(part.fill, offset, offset + part.bytes);
    }
    if (part.sourceVaddr === undefined || part.liveBytes === 0) continue;
    const source = sourceOffsetOf(pbElf, part.sourceVaddr);
    segment.set(pbElf.subarray(source, source + part.liveBytes), offset);
  }
  cloneSurplusSongs(
    segment,
    layout.vaddr.songDb - SEGMENT_VADDR,
    capacity.songCount,
    layout.songEntrySize,
  );
  return segment;
}

/** 空のPT_LOADを1つ見つけ、連ねたセグメントを割り当てたELFを返す。 */
export function appendSegment(
  pbElf: Uint8Array,
  segment: Uint8Array,
): Uint8Array {
  const appendOffset = align16(pbElf.length);
  const out = new Uint8Array(appendOffset + segment.length);
  out.set(pbElf);
  out.set(segment, appendOffset);
  const view = new DataView(out.buffer);
  const phoff = view.getUint32(0x1c, true);
  const phnum = view.getUint16(0x2c, true);
  for (let index = 0; index < phnum; index++) {
    const at = phoff + index * PHENTSIZE;
    const empty = view.getUint32(at + 16, true) === 0 &&
      view.getUint32(at + 20, true) === 0;
    if (view.getUint32(at, true) !== PT_LOAD || !empty) continue;
    view.setUint32(at + 4, appendOffset, true);
    view.setUint32(at + 8, SEGMENT_VADDR, true);
    view.setUint32(at + 12, SEGMENT_VADDR, true);
    view.setUint32(at + 16, segment.length, true);
    view.setUint32(at + 20, segment.length, true);
    return out;
  }
  throw new Error("空のPT_LOADが無い");
}
