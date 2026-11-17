/** 1命令語からフィールドを取り出す。 */

export type Decoded = Readonly<{
  op: number;
  fn: number;
  rs: number;
  rt: number;
  rd: number;
  sa: number;
  imm: number;
}>;

export const opOf = (word: number) => word >>> 26;
export const fnOf = (word: number) => word & 0x3f;
export const rsOf = (word: number) => (word >>> 21) & 31;
export const rtOf = (word: number) => (word >>> 16) & 31;
export const rdOf = (word: number) => (word >>> 11) & 31;
export const saOf = (word: number) => (word >>> 6) & 31;
/** 符号付きの16bit即値。 */
export const immOf = (word: number) => (word << 16) >> 16;

export function decodeFields(word: number): Decoded {
  return {
    fn: fnOf(word),
    imm: immOf(word),
    op: opOf(word),
    rd: rdOf(word),
    rs: rsOf(word),
    rt: rtOf(word),
    sa: saOf(word),
  };
}

/** 即値を差し替える。上位16bitはそのまま残す。 */
export const withImmediate = (word: number, imm: number) =>
  ((word & 0xffff0000) | (imm & 0xffff)) >>> 0;

/** 上位16bit。符号拡張形式では下位が負に振れるぶんを繰り上げる。 */
export const hiOf = (value: number, zeroExt: boolean) =>
  zeroExt ? (value >>> 16) & 0xffff : ((value + 0x8000) >>> 16) & 0xffff;

/** 即値を零拡張する opcode(andi/ori/xori)。 */
export const isZeroExt = (word: number) => {
  const op = opOf(word);
  return op === 0x0c || op === 0x0d || op === 0x0e;
};
