// ADPCM本体に掛ける、コンテナに依存しない変換。

/** 1フレーム = 16バイト = 28サンプル */
export const FRAME = 16;

/**
 * `file_entries.rate` の符号化。上位バイトが整数半音、下位バイトが7ビットの小数
 * (引き算)で、V = 128*hi - lo が 1/128半音単位のピッチ、V=7680 が 48000Hz。
 */
export function encodeRate(rate: number): number {
  const pitch = Math.round(7680 + 1536 * Math.log2(48000 / rate));
  const hi = Math.ceil(pitch / 128);
  return (hi << 8) | (128 * hi - pitch);
}

/**
 * キー音1チャンネル分を公式と同じ形へ変える。
 * - `byte0 ^= 0xFF` と `byte2 -= 0x24` が `is_encrypted=1` の暗号化そのもの。
 *   この変換で正しく復号できるのは、先頭フレームが無音のときに限る
 * - フレームindex 1の `byte1` (SPUのループ開始フラグ) は暗号化の有無に関わらず 0 にする。
 *   旧側の 0x04 を残すと終端フラグと組み合わさってキー音がループし続ける
 */
export function cipherKeysoundChannel(
  buf: Uint8Array,
  start: number,
  size: number,
  cipher: boolean,
): void {
  if (cipher) {
    for (let p = start; p < start + size; p += FRAME) {
      buf[p] ^= 0xff;
      buf[p + 2] = (buf[p + 2] - 0x24) & 0xff;
    }
  }
  if (size >= FRAME * 2) buf[start + FRAME + 1] = 0x00;
}

/**
 * 暗号化済みの本体`buf[start, end)`を平文へ戻す。先頭フレームの平文は全ゼロなので、
 * 暗号化された先頭4バイトがそのまま鍵になる。byte0はXOR、byte1〜3は減算。
 * 参考: https://github.com/vgmstream/vgmstream の`src/meta/vig_kces_streamfile.h`
 */
export function decryptFrames(
  buf: Uint8Array,
  start: number,
  end: number,
): void {
  const key = buf.slice(start, start + 4);
  for (let p = start; p < end; p += FRAME) {
    buf[p] ^= key[0];
    buf[p + 1] = (buf[p + 1] - key[1]) & 0xff;
    buf[p + 2] = (buf[p + 2] - key[2]) & 0xff;
    buf[p + 3] = (buf[p + 3] - key[3]) & 0xff;
  }
}

/** era1 BGMのインターリーブ単位 */
export const ERA1_BGM_BLOCK = 0x800;

/**
 * ステレオ本体を `0x800` バイトブロックの L/R 交互から、1フレーム交互へ並べ替える。
 * era1 BGMを `01 00 64 08` コンテナへ移すときに必要な唯一の本体処理。
 */
export function reinterleaveBlocksToFrames(src: Uint8Array): Uint8Array {
  if (src.length % (ERA1_BGM_BLOCK * 2) !== 0) {
    throw new Error(
      `本体サイズ ${src.length} が ${
        ERA1_BGM_BLOCK * 2
      } の倍数でない(ブロック対に割れない)`,
    );
  }
  const half = src.length / 2;
  const left = new Uint8Array(half);
  const right = new Uint8Array(half);
  for (
    let p = 0, l = 0, r = 0, toggle = 0;
    p < src.length;
    p += ERA1_BGM_BLOCK
  ) {
    const block = src.subarray(p, p + ERA1_BGM_BLOCK);
    if (toggle === 0) {
      left.set(block, l);
      l += ERA1_BGM_BLOCK;
    } else {
      right.set(block, r);
      r += ERA1_BGM_BLOCK;
    }
    toggle ^= 1;
  }
  const out = new Uint8Array(src.length);
  for (let f = 0, o = 0; f < half; f += FRAME, o += FRAME * 2) {
    out.set(left.subarray(f, f + FRAME), o);
    out.set(right.subarray(f, f + FRAME), o + FRAME);
  }
  return out;
}

export function isSilentFrame(buf: Uint8Array, at: number): boolean {
  return buf.subarray(at, at + FRAME).every((b) => b === 0);
}
