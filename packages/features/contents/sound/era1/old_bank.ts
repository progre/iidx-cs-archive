// era1 のヘッダレス旧バンクの読み出し。
//
// 読み出しで注意する点は2つある。
//   - `entry_type 4` はステレオ(モノラルとして読むと右chを丸ごと落とす)
//   - サンプル数は先頭フレームと終端フレームも数える(数えないと32バイト過小になる)

export interface OldEntry {
  entryId: number;
  /** `+0x02` u16の優先度の下位バイト */
  unk02: number;
  /** `+0x03` u16の優先度の上位バイト */
  unk03: number;
  unk04: number;
  volume: number;
  pan: number;
  /** `+0x07` の下位4bit。bit3は音量の系統で格納方法に関わらないので、種別は下位2bitで読む */
  entryType: number;
  /** `+0x07` のbit3〜4。0はキー音、1はBGMの音量で鳴らす */
  volumeGroup: number;
  rate1: number;
  rate2: number;
  offset1: number;
  offset2: number;
  filesizeField: number;
  tail: number;
  /** 1=モノラル、2=ステレオ */
  ch: number;
  /** 1チャンネルあたりのバイト数 */
  size: number;
  /** バンク先頭からのデータ位置(ステレオは左ch。右chはこの size バイト後ろ) */
  dataOffset: number;
}

export interface OldBank {
  archiveSize: number;
  sectionSize: number;
  section2Off: number;
  entries: OldEntry[];
}

/** 終端フレームまで走査して長さを決める。前後に1フレームずつ足す */
function scanSize(buf: Uint8Array, offset: number): number {
  let p = offset + 16;
  let size = 16; // 先頭フレーム
  while (p + 16 <= buf.length) {
    const f = buf.subarray(p, p + 16);
    const end = (f[0] === 0x00 && f[1] === 0x07 &&
      (f.subarray(2).every((b) => b === 0x77) ||
        f.subarray(2).every((b) => b === 0x00))) ||
      f.every((b) => b === 0x00);
    size += 16;
    p += 16;
    // 終端フレームも実データに含める
    if (end) {
      break;
    }
  }
  return size;
}

export function parseOld(buf: Uint8Array): OldBank {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const archiveSize = dv.getUint32(0, true);
  if (archiveSize !== buf.length) {
    throw new Error(
      `旧形式ではない: 先頭u32=${archiveSize} != 長さ=${buf.length}`,
    );
  }
  const sectionSize = dv.getUint32(4, true);
  const section2Off = dv.getUint32(8, true);
  const base2 = archiveSize - section2Off;

  const entries: OldEntry[] = [];
  for (let p = 0x20; p < 0x4000; p += 0x20) {
    const entryType = buf[p + 7] & 0x0f;
    if (entryType === 0) {
      continue;
    }
    const kind = entryType & 0x03;
    const offset1 = dv.getUint32(p + 0x10, true);
    const offset2 = dv.getUint32(p + 0x14, true);
    const filesizeField = dv.getUint32(p + 0x18, true);
    let ch = 1, size = 0, dataOffset = 0;
    if (kind === 2) {
      dataOffset = offset1 - 0xf020;
      size = scanSize(buf, dataOffset);
    } else if (kind === 0) {
      dataOffset = offset1 - 0xf020;
      size = offset2 - offset1;
      ch = 2;
    } else if (kind === 3) {
      dataOffset = base2 + offset1;
      size = filesizeField;
    } else {
      throw new Error(
        `未知の種別 ${kind} (entry_type ${entryType}) @0x${p.toString(16)}`,
      );
    }
    if (size <= 0 || size % 16 !== 0) {
      throw new Error(`サイズ異常 ${size} @0x${p.toString(16)}`);
    }
    if (dataOffset < 0 || dataOffset + size * ch > buf.length) {
      throw new Error(`範囲外 offset=${dataOffset} size=${size}x${ch}ch`);
    }
    entries.push({
      entryId: dv.getUint16(p, true),
      unk02: buf[p + 2],
      unk03: buf[p + 3],
      unk04: buf[p + 4],
      volume: buf[p + 5],
      pan: buf[p + 6],
      entryType,
      volumeGroup: (buf[p + 7] >> 3) & 3,
      rate1: dv.getUint32(p + 8, true),
      rate2: dv.getUint32(p + 0x0c, true),
      offset1,
      offset2,
      filesizeField,
      tail: dv.getUint32(p + 0x1c, true),
      ch,
      size,
      dataOffset,
    });
  }
  entries.sort((a, b) => a.entryId - b.entryId);
  return { archiveSize, sectionSize, section2Off, entries };
}
