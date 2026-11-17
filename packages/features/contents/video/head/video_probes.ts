// 原盤のムービーの中身を読んで、解像度と、2本が同じかを調べる。

// MPEG-PS動画(PSS)のsequence_header(0x000001B3)から解像度を読む。
// 映像のみのMPEG-PSを前提にする。

export interface SequenceHeader {
  offset: number;
  width: number;
  height: number;
}

/** バッファ内で最初に見つかった sequence_header の位置と解像度を返す。 */
export function findSequenceHeader(buf: Uint8Array): SequenceHeader | null {
  for (let p = 0; p + 7 <= buf.length; p++) {
    if (
      buf[p] === 0 && buf[p + 1] === 0 && buf[p + 2] === 1 &&
      buf[p + 3] === 0xb3
    ) {
      const b0 = buf[p + 4], b1 = buf[p + 5], b2 = buf[p + 6];
      const width = (b0 << 4) | (b1 >> 4);
      const height = ((b1 & 0x0f) << 8) | b2;
      return { offset: p, width, height };
    }
  }
  return null;
}

const SEQUENCE_HEADER_PROBE = 65536;

const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

function fail(message: string): never {
  throw new Error(message);
}

/** `readSegment`は、原盤のファイルの先頭から`file.size`バイトを読む */
export const videoProbesOf = <F extends { index: number; size: number }>(
  generation: string,
  readSegment: (file: F) => Promise<Uint8Array>,
) => ({
  readResolution: async (file: F) => {
    const head = await readSegment({
      ...file,
      size: Math.min(SEQUENCE_HEADER_PROBE, file.size),
    });
    const header = findSequenceHeader(head) ??
      fail(`${generation} file${file.index} sequence_headerが無い`);
    return { height: header.height, width: header.width };
  },
  // 原盤の読み出しは位置を移してから読むので、2本を同時に読まない
  sameBytes: async (a: F, b: F) =>
    a.size === b.size &&
    equalBytes(await readSegment(a), await readSegment(b)),
});
