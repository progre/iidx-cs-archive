/** R5900命令の符号化。レジスターは番号で受ける。 */

export const reg = {
  a0: 4,
  a1: 5,
  a2: 6,
  a3: 7,
  at: 1,
  gp: 28,
  ra: 31,
  s0: 16,
  s1: 17,
  s2: 18,
  s3: 19,
  s4: 20,
  s5: 21,
  sp: 29,
  t0: 8,
  t1: 9,
  t2: 10,
  t3: 11,
  t4: 12,
  t8: 24,
  t9: 25,
  v0: 2,
  v1: 3,
  zero: 0,
} as const;

const imm16 = (value: number) => {
  if (value < -0x8000 || value > 0xffff) {
    throw new Error("16bit即値に収まらない: " + value);
  }
  return value & 0xffff;
};
const iType = (op: number, rs: number, rt: number, imm: number) =>
  ((op << 26) | (rs << 21) | (rt << 16) | imm16(imm)) >>> 0;
const rType = (rs: number, rt: number, rd: number, sa: number, fn: number) =>
  ((rs << 21) | (rt << 16) | (rd << 11) | (sa << 6) | fn) >>> 0;

export const addiu = (rt: number, rs: number, imm: number) =>
  iType(0x09, rs, rt, imm);
export const addu = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x21);
export const daddu = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x2d);
export const and = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x24);
/** offsetは分岐の次の命令から数えた語数 */
export const beq = (rs: number, rt: number, offset: number) =>
  iType(0x04, rs, rt, offset);
export const blez = (rs: number, offset: number) => iType(0x06, rs, 0, offset);
export const bltz = (rs: number, offset: number) => iType(0x01, rs, 0, offset);
export const bne = (rs: number, rt: number, offset: number) =>
  iType(0x05, rs, rt, offset);
export const divu = (rs: number, rt: number) => rType(rs, rt, 0, 0, 0x1b);
export const jal = (target: number) => ((3 << 26) | (target >>> 2)) >>> 0;
export const jr = (rs: number) => rType(rs, 0, 0, 0, 0x08);
export const lb = (rt: number, imm: number, rs: number) =>
  iType(0x20, rs, rt, imm);
export const lbu = (rt: number, imm: number, rs: number) =>
  iType(0x24, rs, rt, imm);
export const ld = (rt: number, imm: number, rs: number) =>
  iType(0x37, rs, rt, imm);
export const lh = (rt: number, imm: number, rs: number) =>
  iType(0x21, rs, rt, imm);
export const lui = (rt: number, imm: number) => iType(0x0f, 0, rt, imm);
export const lw = (rt: number, imm: number, rs: number) =>
  iType(0x23, rs, rt, imm);
export const mfhi = (rd: number) => rType(0, 0, rd, 0, 0x10);
/** R5900の3オペランド形。積の下位32bitを`rd`にも書く。 */
export const mult = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x18);
export const or = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x25);
export const ori = (rt: number, rs: number, imm: number) =>
  iType(0x0d, rs, rt, imm);
export const sb = (rt: number, imm: number, rs: number) =>
  iType(0x28, rs, rt, imm);
export const sd = (rt: number, imm: number, rs: number) =>
  iType(0x3f, rs, rt, imm);
export const sll = (rd: number, rt: number, sa: number) =>
  rType(0, rt, rd, sa, 0x00);
export const slti = (rt: number, rs: number, imm: number) =>
  iType(0x0a, rs, rt, imm);
export const sltiu = (rt: number, rs: number, imm: number) =>
  iType(0x0b, rs, rt, imm);
export const srl = (rd: number, rt: number, sa: number) =>
  rType(0, rt, rd, sa, 0x02);
/** `rt`を`rs`の下位5bitだけ右へ論理シフトする */
export const srlv = (rd: number, rt: number, rs: number) =>
  rType(rs, rt, rd, 0, 0x06);
export const subu = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x23);
export const sw = (rt: number, imm: number, rs: number) =>
  iType(0x2b, rs, rt, imm);
export const xor = (rd: number, rs: number, rt: number) =>
  rType(rs, rt, rd, 0, 0x26);
export const xori = (rt: number, rs: number, imm: number) =>
  iType(0x0e, rs, rt, imm);

export const move = (rd: number, rs: number) => or(rd, rs, 0);
export const NOP = 0;

export const words = (source: string) =>
  source.split(" ").map((word) => parseInt(word, 16));

/** 絶対addressを`lui`+`addiu`の組で作る。下位は符号付きなので上位を繰り上げる。 */
export function pairWords(rt: number, address: number): [number, number] {
  return [
    lui(rt, ((address + 0x8000) >>> 16) & 0xffff),
    addiu(rt, rt, address & 0xffff),
  ];
}
