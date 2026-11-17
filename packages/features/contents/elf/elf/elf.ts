/** 32bit LEのELF。PT_LOADをvaddrで引き、その場で読み書きする。 */

export type LoadSegment = Readonly<{
  fileOffset: number;
  fileSize: number;
  vaddr: number;
}>;

export type WordSource = Readonly<{ wordAt(vaddr: number): number | null }>;

const ELF_MAGIC = 0x7f454c46;
const PT_LOAD = 1;

export class MutableElf implements WordSource {
  readonly bytes: Uint8Array;
  readonly dv: DataView;
  readonly segments: readonly LoadSegment[];

  constructor(input: Uint8Array) {
    this.bytes = input.slice();
    this.dv = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength,
    );
    if (this.dv.getUint32(0, false) !== ELF_MAGIC) {
      throw new Error("ELFマジック不一致");
    }
    const phoff = this.dv.getUint32(0x1c, true);
    const phentsize = this.dv.getUint16(0x2a, true);
    const phnum = this.dv.getUint16(0x2c, true);
    const segments: LoadSegment[] = [];
    for (let index = 0; index < phnum; index++) {
      const offset = phoff + index * phentsize;
      if (this.dv.getUint32(offset, true) !== PT_LOAD) continue;
      segments.push({
        fileOffset: this.dv.getUint32(offset + 4, true),
        fileSize: this.dv.getUint32(offset + 16, true),
        vaddr: this.dv.getUint32(offset + 8, true),
      });
    }
    this.segments = segments;
  }

  vaddrToOffset(vaddr: number, bytes = 1): number {
    for (const segment of this.segments) {
      if (
        vaddr >= segment.vaddr &&
        vaddr + bytes <= segment.vaddr + segment.fileSize
      ) {
        return segment.fileOffset + vaddr - segment.vaddr;
      }
    }
    throw new Error(`vaddr 0x${vaddr.toString(16)}がPT_LOADに無い`);
  }

  /** PT_LOADの外は`null`。書き換え帳が対象外のaddressを弾くのに使う。 */
  wordAt(vaddr: number): number | null {
    for (const segment of this.segments) {
      if (
        vaddr >= segment.vaddr &&
        vaddr + 4 <= segment.vaddr + segment.fileSize
      ) {
        return this.dv.getUint32(
          segment.fileOffset + vaddr - segment.vaddr,
          true,
        );
      }
    }
    return null;
  }

  readPairEa(hiVaddr: number, loVaddr: number): number {
    const hi = this.u32(hiVaddr) & 0xffff;
    let lo = this.u32(loVaddr) & 0xffff;
    if (lo >= 0x8000) lo -= 0x10000;
    return ((hi << 16) + lo) >>> 0;
  }

  slice(vaddr: number, bytes: number): Uint8Array {
    const offset = this.vaddrToOffset(vaddr, bytes);
    return this.bytes.slice(offset, offset + bytes);
  }

  setBytes(vaddr: number, value: Uint8Array): void {
    this.bytes.set(value, this.vaddrToOffset(vaddr, value.length));
  }

  u16(vaddr: number): number {
    return this.dv.getUint16(this.vaddrToOffset(vaddr, 2), true);
  }

  setU16(vaddr: number, value: number): void {
    this.dv.setUint16(this.vaddrToOffset(vaddr, 2), value, true);
  }

  u32(vaddr: number): number {
    return this.dv.getUint32(this.vaddrToOffset(vaddr, 4), true);
  }

  setU32(vaddr: number, value: number): void {
    this.dv.setUint32(this.vaddrToOffset(vaddr, 4), value >>> 0, true);
  }

  replaceWords(
    startVaddr: number,
    expected: number[],
    replacement: number[],
  ): void {
    if (replacement.length > expected.length) {
      throw new Error("置換命令が元命令範囲を超える");
    }
    for (let i = 0; i < expected.length; i++) {
      const address = startVaddr + i * 4;
      const actual = this.u32(address);
      if (actual !== (expected[i] >>> 0)) {
        throw new Error(
          `0x${address.toString(16)}旧命令0x${actual.toString(16)} != 0x${
            (expected[i] >>> 0).toString(16)
          }`,
        );
      }
      this.setU32(address, replacement[i] ?? 0);
    }
  }
}

/** PT_LOADの外を読んだら止める。書き換えの組み立てはこちらを使う。 */
export function requireWord(source: WordSource, vaddr: number): number {
  const word = source.wordAt(vaddr);
  if (word === null) {
    throw new Error("ELF外のaddress: 0x" + (vaddr >>> 0).toString(16));
  }
  return word;
}
