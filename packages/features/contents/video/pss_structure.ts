// PSS(映像のみMPEG-PS)のコンテナ構造を読む。パック長の分布、ストリームID、
// system headerの有無、sequence_headerの解像度・アスペクト比・ビットレートを1行ずつ出す。
// PB原盤と再多重化した出力を同じ目で比べるために使う。
//
// 実行: deno run --allow-read=<dir> packages/features/contents/video/pss_structure.ts <file.pss> [...]

const PACK_START = 0xba;
const SYSTEM_HEADER = 0xbb;
const SEQUENCE_HEADER = 0xb3;
const END_CODE = 0xb9;

function startCodeAt(bytes: Uint8Array, offset: number): number | null {
  if (
    offset + 4 > bytes.length || bytes[offset] !== 0 ||
    bytes[offset + 1] !== 0 || bytes[offset + 2] !== 1
  ) return null;
  return bytes[offset + 3];
}

export interface PssSummary {
  aspect: number;
  bitRateKbps: number;
  frameRateCode: number;
  height: number;
  packs: Map<number, number>;
  pesPerPack: Map<number, number>;
  streams: Map<number, number>;
  systemHeaders: number;
  /** 終端コードの後ろに残るバイト数。終端コードが無ければ-1 */
  trailing: number;
  width: number;
}

export function summarizePss(bytes: Uint8Array): PssSummary {
  const summary: PssSummary = {
    aspect: 0,
    bitRateKbps: 0,
    frameRateCode: 0,
    height: 0,
    packs: new Map(),
    pesPerPack: new Map(),
    streams: new Map(),
    systemHeaders: 0,
    trailing: -1,
    width: 0,
  };
  let offset = 0;
  let packStart = -1;
  let pesCount = 0;
  const closePack = (end: number) => {
    if (packStart < 0) return;
    const length = end - packStart;
    summary.packs.set(length, (summary.packs.get(length) ?? 0) + 1);
    summary.pesPerPack.set(
      pesCount,
      (summary.pesPerPack.get(pesCount) ?? 0) + 1,
    );
  };
  while (offset + 4 <= bytes.length) {
    const code = startCodeAt(bytes, offset);
    if (code === null) {
      throw new Error(`0x${offset.toString(16)}に開始コードが無い`);
    }
    if (code === PACK_START) {
      closePack(offset);
      packStart = offset;
      pesCount = 0;
      // MPEG-2 pack header: 14バイト + stuffing(下位3bit)
      offset += 14 + (bytes[offset + 13] & 0x07);
      continue;
    }
    if (code === END_CODE) {
      closePack(offset);
      packStart = -1;
      summary.trailing = bytes.length - offset - 4;
      break;
    }
    const length = (bytes[offset + 4] << 8) | bytes[offset + 5];
    if (code === SYSTEM_HEADER) summary.systemHeaders++;
    else {
      summary.streams.set(code, (summary.streams.get(code) ?? 0) + 1);
      pesCount++;
      if (summary.width === 0 && code >= 0xe0 && code <= 0xef) {
        readSequenceHeader(bytes, offset + 6, offset + 6 + length, summary);
      }
    }
    offset += 6 + length;
  }
  return summary;
}

function readSequenceHeader(
  bytes: Uint8Array,
  start: number,
  end: number,
  summary: PssSummary,
): void {
  for (let i = start; i + 12 <= end; i++) {
    if (startCodeAt(bytes, i) !== SEQUENCE_HEADER) continue;
    summary.width = (bytes[i + 4] << 4) | (bytes[i + 5] >> 4);
    summary.height = ((bytes[i + 5] & 0x0f) << 8) | bytes[i + 6];
    summary.aspect = bytes[i + 7] >> 4;
    summary.frameRateCode = bytes[i + 7] & 0x0f;
    const bitRate = (bytes[i + 8] << 10) | (bytes[i + 9] << 2) |
      (bytes[i + 10] >> 6);
    summary.bitRateKbps = Math.round(bitRate * 400 / 1000);
    return;
  }
}

/** 映像PES(0xE0)のpayloadを連結したES。ピクチャ数の照合に使う */
export function extractVideoEs(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let offset = 0;
  while (offset + 4 <= bytes.length) {
    const code = startCodeAt(bytes, offset);
    if (code === null) {
      throw new Error(`0x${offset.toString(16)}に開始コードが無い`);
    }
    if (code === PACK_START) {
      offset += 14 + (bytes[offset + 13] & 0x07);
      continue;
    }
    if (code === END_CODE) break;
    const length = (bytes[offset + 4] << 8) | bytes[offset + 5];
    if (code === 0xe0) {
      const headerLength = bytes[offset + 8];
      parts.push(
        bytes.subarray(offset + 9 + headerLength, offset + 6 + length),
      );
    }
    offset += 6 + length;
  }
  const es = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let position = 0;
  for (const part of parts) {
    es.set(part, position);
    position += part.length;
  }
  return es;
}

export function countPictures(es: Uint8Array): number {
  let count = 0;
  for (let i = 0; i + 4 <= es.length; i++) {
    if (startCodeAt(es, i) === 0x00) count++;
  }
  return count;
}

const describe = (map: Map<number, number>, hex: boolean) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) =>
    `${hex ? "0x" + key.toString(16) : key}x${count}`
  ).join(" ");

export function describePssSummary(s: PssSummary): string {
  return `${s.width}x${s.height} aspect_code=${s.aspect} frame_rate_code=${s.frameRateCode} ` +
    `bit_rate=${s.bitRateKbps}kbps | packs ${describe(s.packs, false)} | ` +
    `pes/pack ${describe(s.pesPerPack, false)} | streams ${
      describe(s.streams, true)
    } | system_header ${s.systemHeaders} | trailing ${s.trailing}`;
}

if (import.meta.main) {
  for (const path of Deno.args) {
    console.log(
      `${path}: ${describePssSummary(summarizePss(Deno.readFileSync(path)))}`,
    );
  }
}
