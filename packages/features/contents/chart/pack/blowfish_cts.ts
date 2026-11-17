// Blowfish CBC-CTS(ciphertext stealing)。IVはゼロ8バイト固定で、ブロックは
// 4バイトのワードを little endian で読む(npmのBlowfishは big endian なので、
// 各ワードのバイト順を入れ替えて通す)。
// 長さは8バイトより長く、8の倍数でないものだけ受ける。
// 既存ツールの暗号化は、長さが8の倍数のとき、最終ブロックを出力に含めない。
// 譜面を書く側は長さを調整できるので、8の倍数の長さは受けない。
// 参考: https://github.com/SaxxonPike/iidx-ps2tools の`common.py`の`decrypt_blowfish`

import { Blowfish } from "egoroof-blowfish";

const BLOCK = 8;
const ZERO_IV = new Uint8Array(BLOCK);

/** 各4バイトのワードのバイト順を入れ替える。元の配列は変えない */
function swapWords(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = data[i + 3];
    out[i + 1] = data[i + 2];
    out[i + 2] = data[i + 1];
    out[i + 3] = data[i];
  }
  return out;
}

function cbc(key: Uint8Array): Blowfish {
  const cipher = new Blowfish(key, Blowfish.MODE.CBC, Blowfish.PADDING.NULL);
  cipher.setIv(ZERO_IV);
  return cipher;
}

function checkLength(length: number): number {
  const extra = length % BLOCK;
  if (length <= BLOCK || extra === 0) {
    throw new Error("CBC-CTSの入力は8バイトより長く、8の倍数でない");
  }
  return extra;
}

const xor = (a: Uint8Array, b: Uint8Array) => a.map((value, i) => value ^ b[i]);

export function encryptCbcCts(data: Uint8Array, key: Uint8Array): Uint8Array {
  const extra = checkLength(data.length);
  const fullEnd = data.length - extra;
  const cipher = cbc(key);
  const chained = swapWords(
    cipher.encode(swapWords(data.subarray(0, fullEnd))),
  );
  const held = chained.subarray(fullEnd - BLOCK);
  const padded = new Uint8Array(BLOCK);
  padded.set(data.subarray(fullEnd));
  cipher.setIv(ZERO_IV);
  const special = swapWords(cipher.encode(swapWords(xor(padded, held))));
  const out = new Uint8Array(data.length);
  out.set(chained.subarray(0, fullEnd - BLOCK));
  out.set(special, fullEnd - BLOCK);
  out.set(held.subarray(0, extra), fullEnd);
  return out;
}

/**
 * npmのBlowfishは復号の末尾にあるゼロを詰め物として削るので、
 * 末尾に0xFFのブロックを足して復号し、足した分を取り除く。
 */
function decryptBlocks(
  cipher: Blowfish,
  blocks: Uint8Array,
  previous: Uint8Array,
): Uint8Array {
  if (blocks.length === 0) {
    return blocks;
  }
  const last = blocks.subarray(blocks.length - BLOCK);
  cipher.setIv(swapWords(last));
  const sentinel = cipher.encode(new Uint8Array(BLOCK).fill(0xff));
  cipher.setIv(swapWords(previous));
  const joined = new Uint8Array(blocks.length + BLOCK);
  joined.set(swapWords(blocks));
  joined.set(sentinel, blocks.length);
  return swapWords(cipher.decode(joined, Blowfish.TYPE.UINT8_ARRAY)).subarray(
    0,
    blocks.length,
  );
}

/**
 * 長さが8の倍数の入力を、ゼロIVのCBCとして復号する。
 * 既存ツールは、8の倍数のとき0を8バイト足してCBC-CTSへ渡す。
 * この方法で復号すると、元のブロックはCBCで復号され、足した8バイトの位置には意味のない値が入る。
 * 譜面のLZは終端トークンで読み取りを止めるので、足した分は結果に影響しない。
 */
export function decryptCbcWholeBlocks(
  data: Uint8Array,
  key: Uint8Array,
): Uint8Array {
  if (data.length % BLOCK !== 0) {
    throw new Error("8の倍数の長さだけ受ける");
  }
  return decryptBlocks(cbc(key), data, ZERO_IV);
}

export function decryptCbcCts(data: Uint8Array, key: Uint8Array): Uint8Array {
  const extra = checkLength(data.length);
  const fullEnd = data.length - extra;
  const specialStart = fullEnd - BLOCK;
  const cipher = cbc(key);
  const head = decryptBlocks(
    cipher,
    data.subarray(0, specialStart),
    ZERO_IV,
  );
  const previous = specialStart === 0
    ? ZERO_IV
    : data.subarray(specialStart - BLOCK, specialStart);
  const special = data.subarray(specialStart, fullEnd);
  const tail = new Uint8Array(BLOCK);
  tail.set(data.subarray(fullEnd));
  // 特別ブロックを単独で復号(IVゼロのCBC=ECB)し、尾の暗号文と足して平文の尾を得る
  const xn = xor(decryptBlocks(cipher, special, ZERO_IV), tail);
  const heldBlock = new Uint8Array(BLOCK);
  heldBlock.set(data.subarray(fullEnd));
  heldBlock.set(xn.subarray(extra), extra);
  const lastPlain = xor(decryptBlocks(cipher, heldBlock, ZERO_IV), previous);
  const out = new Uint8Array(data.length);
  out.set(head);
  out.set(lastPlain, specialStart);
  out.set(xn.subarray(0, extra), fullEnd);
  return out;
}
