// PS2 GSのswizzle済み8bppテクスチャをRGBAへ戻す。
// 転送はPSMCT32(幅/2×高さ/2の32bit語)で行われ、参照はPSMT8で行われるため、
// 一度GSメモリ配置へ書いてからPSMT8の並びで読み直す(ezswizzle由来)。

// deno-fmt-ignore
const BLOCK32 = [
  0, 1, 4, 5, 16, 17, 20, 21,
  2, 3, 6, 7, 18, 19, 22, 23,
  8, 9, 12, 13, 24, 25, 28, 29,
  10, 11, 14, 15, 26, 27, 30, 31,
];
const COLUMN_WORD32 = [0, 1, 4, 5, 8, 9, 12, 13, 2, 3, 6, 7, 10, 11, 14, 15];
const BLOCK8 = BLOCK32;
// deno-fmt-ignore
const COLUMN_WORD8 = [
  [
    0, 1, 4, 5, 8, 9, 12, 13, 0, 1, 4, 5, 8, 9, 12, 13,
    2, 3, 6, 7, 10, 11, 14, 15, 2, 3, 6, 7, 10, 11, 14, 15,
    8, 9, 12, 13, 0, 1, 4, 5, 8, 9, 12, 13, 0, 1, 4, 5,
    10, 11, 14, 15, 2, 3, 6, 7, 10, 11, 14, 15, 2, 3, 6, 7,
  ],
  [
    8, 9, 12, 13, 0, 1, 4, 5, 8, 9, 12, 13, 0, 1, 4, 5,
    10, 11, 14, 15, 2, 3, 6, 7, 10, 11, 14, 15, 2, 3, 6, 7,
    0, 1, 4, 5, 8, 9, 12, 13, 0, 1, 4, 5, 8, 9, 12, 13,
    2, 3, 6, 7, 10, 11, 14, 15, 2, 3, 6, 7, 10, 11, 14, 15,
  ],
];
// deno-fmt-ignore
const COLUMN_BYTE8 = [
  0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2,
  0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2,
  1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3,
  1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3,
];
export const PALETTE_BYTES = 0x400;
const GS_BYTES = 4 * 1024 * 1024;

/** PSMCT32配置での語アドレス。転送幅rrwは64語単位 */
function ct32Word(x: number, y: number, dbw: number): number {
  const page = (x >> 6) + (y >> 5) * dbw;
  const px = x & 63;
  const py = y & 31;
  const block = BLOCK32[(px >> 3) + (py >> 3) * 8];
  const by = py & 7;
  return page * 2048 + block * 64 + (by >> 1) * 16 +
    COLUMN_WORD32[(px & 7) + (by & 1) * 8];
}

/** PSMT8配置でのバイトアドレス。dbwは64ピクセル単位の幅を半分にした値 */
function t8Byte(x: number, y: number, dbw: number): number {
  const page = (x >> 7) + (y >> 6) * dbw;
  const px = x & 127;
  const py = y & 63;
  const block = BLOCK8[(px >> 4) + (py >> 4) * 8];
  const bx = px & 15;
  const by = py & 15;
  const column = by >> 2;
  const cw = COLUMN_WORD8[column & 1][bx + (by & 3) * 16];
  const cb = COLUMN_BYTE8[bx + (by & 3) * 16];
  return (page * 2048 + block * 64 + column * 16 + cw) * 4 + cb;
}

/** CLUTの並び替え。index 8〜15と16〜23が入れ替わって格納される */
export function clutIndex(index: number): number {
  return (index & ~0x18) | ((index & 0x08) << 1) | ((index & 0x10) >> 1);
}

/** texture fileをパレットと画素indexへ分け、swizzleを戻す */
export function decodeIndices8(
  file: Uint8Array,
  width: number,
  height: number,
): { indices: Uint8Array; palette: Uint8Array } {
  const image = file.subarray(PALETTE_BYTES);
  if (image.length !== width * height) {
    throw new Error(`texture長${image.length} != ${width}x${height}`);
  }
  const words = new Uint32Array(
    image.buffer.slice(image.byteOffset, image.byteOffset + image.length),
  );
  const gs = new Uint8Array(GS_BYTES);
  const gs32 = new Uint32Array(gs.buffer);
  const rrw = width >> 1;
  const rrh = height >> 1;
  let i = 0;
  for (let y = 0; y < rrh; y++) {
    for (let x = 0; x < rrw; x++) gs32[ct32Word(x, y, rrw >> 6)] = words[i++];
  }
  const indices = new Uint8Array(width * height);
  const dbw = (width >> 6) >> 1;
  i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) indices[i++] = gs[t8Byte(x, y, dbw)];
  }
  return { indices, palette: file.slice(0, PALETTE_BYTES) };
}

/** decodeIndices8の逆。画素indexをPSMT8で置き、PSMCT32の並びで読み出す */
export function encodeTexture8(
  indices: Uint8Array,
  palette: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  if (indices.length !== width * height || palette.length !== PALETTE_BYTES) {
    throw new Error("texture入力の長さが寸法と合わない");
  }
  const gs = new Uint8Array(GS_BYTES);
  const gs32 = new Uint32Array(gs.buffer);
  const dbw = (width >> 6) >> 1;
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) gs[t8Byte(x, y, dbw)] = indices[i++];
  }
  const out = new Uint8Array(PALETTE_BYTES + width * height);
  out.set(palette);
  const words = new Uint32Array(
    out.buffer,
    PALETTE_BYTES,
    (width * height) >> 2,
  );
  const rrw = width >> 1;
  const rrh = height >> 1;
  i = 0;
  for (let y = 0; y < rrh; y++) {
    for (let x = 0; x < rrw; x++) words[i++] = gs32[ct32Word(x, y, rrw >> 6)];
  }
  return out;
}

/** texture fileをRGBA8(alphaは0..0x80を0..0xffへ伸長)へ展開する */
export function decodeTexture8(
  file: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const { indices, palette } = decodeIndices8(file, width, height);
  const colors = new Uint32Array(palette.buffer, palette.byteOffset, 256);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < indices.length; i++) {
    const color = colors[clutIndex(indices[i])];
    rgba[i * 4] = color & 0xff;
    rgba[i * 4 + 1] = (color >>> 8) & 0xff;
    rgba[i * 4 + 2] = (color >>> 16) & 0xff;
    rgba[i * 4 + 3] = Math.min(255, Math.round(((color >>> 24) / 128) * 255));
  }
  return rgba;
}
