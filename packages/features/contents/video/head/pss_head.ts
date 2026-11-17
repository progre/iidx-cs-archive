// PSSの先頭パックからsequence_headerと多重化の諸元を読む。

export const PACK_SIZE = 16384;

export interface PssHead {
  aspect: number;
  bitRateKbps: number;
  /** 先頭PESのPTS/DTSフラグ(0x80=PTSのみ、0xc0=PTS+DTS) */
  firstPesFlags: number;
  firstPesHeaderLength: number;
  frameRateCode: number;
  height: number;
  muxRateKbps: number;
  systemHeader: boolean;
  width: number;
}

const startCode = (bytes: Uint8Array, at: number, code: number) =>
  bytes[at] === 0 && bytes[at + 1] === 0 && bytes[at + 2] === 1 &&
  bytes[at + 3] === code;

function findStartCode(bytes: Uint8Array, code: number, from = 0): number {
  for (let i = from; i + 4 <= bytes.length; i++) {
    if (startCode(bytes, i, code)) {
      return i;
    }
  }
  return -1;
}

export function parseHead(pack: Uint8Array): PssHead {
  if (!startCode(pack, 0, 0xba)) {
    throw new Error("先頭がパックヘッダーでない");
  }
  const muxRate = (pack[10] << 14) | (pack[11] << 6) | (pack[12] >> 2);
  let offset = 14 + (pack[13] & 0x07);
  const systemHeader = startCode(pack, offset, 0xbb);
  if (systemHeader) {
    offset += 6 + ((pack[offset + 4] << 8) | pack[offset + 5]);
  }
  if (!startCode(pack, offset, 0xe0)) {
    throw new Error("先頭PESが映像でない");
  }
  const sequence = findStartCode(pack, 0xb3, offset);
  if (sequence < 0) {
    throw new Error("先頭パックにsequence_headerが無い");
  }
  return {
    aspect: pack[sequence + 7] >> 4,
    bitRateKbps: Math.round(
      ((pack[sequence + 8] << 10) | (pack[sequence + 9] << 2) |
        (pack[sequence + 10] >> 6)) * 400 / 1000,
    ),
    firstPesFlags: pack[offset + 7],
    firstPesHeaderLength: pack[offset + 8],
    frameRateCode: pack[sequence + 7] & 0x0f,
    height: ((pack[sequence + 5] & 0x0f) << 8) | pack[sequence + 6],
    muxRateKbps: Math.round(muxRate * 400 / 1000),
    systemHeader,
    width: (pack[sequence + 4] << 4) | (pack[sequence + 5] >> 4),
  };
}
