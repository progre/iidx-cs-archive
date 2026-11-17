// 単体PSSファイルの先頭パックと終端を検査し、解像度を文字列で返す。

const PACK_START = 0x000001ba;
const SEQUENCE_HEADER = 0x000001b3;
const END_CODE = 0x000001b9;
const SEARCH_LIMIT = 0x4000;

function startCodeAt(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 24 | bytes[offset + 1] << 16 |
    bytes[offset + 2] << 8 | bytes[offset + 3]) >>> 0;
}

/** 先頭パックの中からsequence_headerを探し、`幅x高さ`を返す */
export function describePss(bytes: Uint8Array): string {
  if (startCodeAt(bytes, 0) !== PACK_START) {
    throw new Error("先頭がパックヘッダでない");
  }
  if (startCodeAt(bytes, bytes.length - 4) !== END_CODE) {
    throw new Error("終端がMPEG終端コードでない");
  }
  const end = Math.min(bytes.length, SEARCH_LIMIT);
  for (let offset = 4; offset + 7 < end; offset++) {
    if (startCodeAt(bytes, offset) !== SEQUENCE_HEADER) {
      continue;
    }
    const width = bytes[offset + 4] << 4 | bytes[offset + 5] >> 4;
    const height = (bytes[offset + 5] & 0x0f) << 8 | bytes[offset + 6];
    return `${width}x${height}`;
  }
  throw new Error("先頭パックにsequence_headerが無い");
}
