// era1の旧バンクを合成するテスト用ヘルパー。

const DATA = 0x4000;
const SPU_BIAS = 0xf020;
const FRAME = 0x10;
/** 1音 = 無音の先頭フレーム + 終端フレーム */
export const SOUND_BYTES = FRAME * 2;

/** `entry_type` を並べた順に1音ずつ持つ旧バンクを作る */
export function oldBank(entryTypes: number[]): Uint8Array {
  const size = DATA + entryTypes.length * SOUND_BYTES;
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0x00, size, true);
  dv.setUint32(0x04, size - DATA, true);
  entryTypes.forEach((entryType, i) => {
    const at = 0x20 + i * 0x20;
    const data = DATA + i * SOUND_BYTES;
    dv.setUint16(at, 5 + i, true);
    buf[at + 0x04] = 255;
    buf[at + 0x05] = 100;
    buf[at + 0x06] = 64;
    buf[at + 0x07] = entryType;
    dv.setUint32(at + 0x08, 44100, true);
    dv.setUint32(at + 0x10, data + SPU_BIAS, true);
    buf[data + FRAME + 1] = 0x07;
    buf.fill(0x77, data + FRAME + 2, data + SOUND_BYTES);
  });
  return buf;
}
