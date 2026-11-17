// MPEG-2映像ES(.m2v)をPB原盤と同じ配置のPSSへ多重化する。
// PBの配置は、16KBパック、PESは4096バイト単位で末尾のPESが
// パックの残りを埋める、ピクチャが始まるPESにだけPTS(B)またはPTS+DTS(I/P)、
// 最後のパックはパディングPES(0xBE)で埋め、sequence_end_codeの後にMPEG終端コードを置く。
//
// 実行: deno run --allow-read=<in dir> --allow-write=<out dir> \
//   packages/features/contents/video/mux_pss.ts <in.m2v> <out.pss>

import { type AccessUnit, scanAccessUnits, timestamp } from "./mpeg2_es.ts";
import { describePssSummary, summarizePss } from "./pss_structure.ts";

const PACK_SIZE = 16384;
const PES_SIZE = 4096;
/** PESヘッダーは常に10バイトへ詰め物し、payload長をPTSの有無で変えない */
const PES_HEADER_LENGTH = 10;
const MUX_RATE_BPS = 4_000_000;
const TICKS_PER_SECOND = 90_000;
/** PB原盤のsystem header。rate_boundは4Mbps、映像のP-STDバッファは1286KiB */
const SYSTEM_HEADER = new Uint8Array(
  "00 00 01 bb 00 09 80 4e 21 00 21 7f e0 e5 06".split(" ").map((byte) =>
    parseInt(byte, 16)
  ),
);
/** 先頭PESのPES拡張(P-STD_buffer)。system headerと同じ1286KiB */
const FIRST_PES_EXTENSION = [0x1e, 0x65, 0x06];
const FIRST_PES_HEADER_LENGTH = 13;
const SEQUENCE_END_CODE = new Uint8Array([0x00, 0x00, 0x01, 0xb7]);
const END_CODE = new Uint8Array([0x00, 0x00, 0x01, 0xb9]);

function fail(message: string): never {
  throw new Error(message);
}

function packHeader(scr: number): Uint8Array {
  const rate = MUX_RATE_BPS / 400;
  return new Uint8Array([
    0x00,
    0x00,
    0x01,
    0xba,
    0x40 | ((Math.floor(scr / 2 ** 30) & 0x07) << 3) | 0x04 |
    ((scr >>> 28) & 0x03),
    (scr >>> 20) & 0xff,
    (((scr >>> 15) & 0x1f) << 3) | 0x04 | ((scr >>> 13) & 0x03),
    (scr >>> 5) & 0xff,
    ((scr & 0x1f) << 3) | 0x04,
    0x01,
    (rate >>> 14) & 0xff,
    (rate >>> 6) & 0xff,
    ((rate & 0x3f) << 2) | 0x03,
    0xf8,
  ]);
}

/** payload範囲で始まる最初のAUのPTS/DTSを載せたPESヘッダー。AUが無ければ詰め物だけ */
function pesHeader(
  unit: AccessUnit | undefined,
  first: boolean,
  headerLength: number,
): Uint8Array {
  const flags = unit === undefined ? 0x00 : unit.isB ? 0x80 : 0xc0;
  const fields = unit === undefined
    ? []
    : unit.isB
    ? timestamp(0x2, unit.pts)
    : [...timestamp(0x3, unit.pts), ...timestamp(0x1, unit.dts)];
  if (first) fields.push(...FIRST_PES_EXTENSION);
  if (fields.length > headerLength) fail("PESヘッダーが詰め物の長さを超えた");
  const header = new Uint8Array(9 + headerLength).fill(0xff);
  header.set([0x00, 0x00, 0x01, 0xe0, 0, 0, 0x83, flags | (first ? 1 : 0)]);
  header[8] = headerLength;
  header.set(fields, 9);
  return header;
}

function paddingPes(bytes: number): Uint8Array {
  const pes = new Uint8Array(bytes).fill(0xff);
  pes.set([0, 0, 1, 0xbe, (bytes - 6) >>> 8, (bytes - 6) & 0xff]);
  return pes;
}

export function muxPss(rawEs: Uint8Array): Uint8Array {
  const es = new Uint8Array(rawEs.length + 4);
  es.set(rawEs);
  es.set(SEQUENCE_END_CODE, rawEs.length);
  const units = scanAccessUnits(es);
  const parts: Uint8Array[] = [];
  let esOffset = 0;
  let unitIndex = 0;
  let packIndex = 0;
  let first = true;
  while (esOffset < es.length) {
    const scr = Math.floor(
      packIndex * PACK_SIZE * 8 * TICKS_PER_SECOND / MUX_RATE_BPS,
    );
    parts.push(packHeader(scr));
    let used = 14;
    if (packIndex === 0) {
      parts.push(SYSTEM_HEADER);
      used += SYSTEM_HEADER.length;
    }
    while (used < PACK_SIZE && esOffset < es.length) {
      const headerLength = first ? FIRST_PES_HEADER_LENGTH : PES_HEADER_LENGTH;
      const room = Math.min(PES_SIZE, PACK_SIZE - used) - 9 - headerLength;
      const payload = Math.min(room, es.length - esOffset);
      // 映像を書き終えたパックの残りがパディングPESに足りなければ、詰め物で吸収する
      const leftover = PACK_SIZE - used - 9 - headerLength - payload;
      const stuffing = leftover > 0 && leftover < 6 ? leftover : 0;
      const payloadEnd = esOffset + payload;
      const unit = units[unitIndex]?.start < payloadEnd
        ? units[unitIndex]
        : undefined;
      while (unitIndex < units.length && units[unitIndex].start < payloadEnd) {
        unitIndex++;
      }
      const header = pesHeader(unit, first, headerLength + stuffing);
      const length = header.length - 6 + payload;
      header[4] = length >>> 8;
      header[5] = length & 0xff;
      parts.push(header, es.subarray(esOffset, payloadEnd));
      used += header.length + payload;
      esOffset = payloadEnd;
      first = false;
    }
    if (used < PACK_SIZE) parts.push(paddingPes(PACK_SIZE - used));
    packIndex++;
  }
  parts.push(END_CODE);
  const result = new Uint8Array(packIndex * PACK_SIZE + END_CODE.length);
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  if (position !== result.length) fail("パック長が揃わない");
  return result;
}

if (import.meta.main) {
  const [input, output] = Deno.args;
  if (!output) fail("<in.m2v> <out.pss>を指定する");
  const pss = muxPss(Deno.readFileSync(input));
  Deno.writeFileSync(output, pss);
  console.log(`${output}: ${describePssSummary(summarizePss(pss))}`);
}
