// MPEG-2映像ESを走査し、アクセスユニット(AU)ごとの開始位置とPTS/DTSを求める。
// AUの始まりは、直前にsequence_header/GOP headerが続いていればその先頭、無ければpicture header。
// PTSは「GOP先頭のDTS + (temporal_reference + 1) × 1フレーム」で、Bピクチャは常にDTSと一致する。

/** PB原盤の先頭PESが持つDTS。以後1フレームずつ進む */
export const DTS_BASE = 737;
/** frame_rate_code → 90kHz単位の1フレーム。4=29.97fps、5=30fps */
const FRAME_TICKS: Record<number, number> = { 4: 3003, 5: 3000 };

export interface AccessUnit {
  dts: number;
  isB: boolean;
  pts: number;
  start: number;
}

function fail(message: string): never {
  throw new Error(message);
}

export function scanAccessUnits(es: Uint8Array): AccessUnit[] {
  let frameTicks = 0;
  const units: AccessUnit[] = [];
  let pendingStart = -1;
  let gopDts = DTS_BASE;
  let nextIsGopStart = true;
  for (let i = 0; i + 5 < es.length; i++) {
    if (es[i] !== 0 || es[i + 1] !== 0 || es[i + 2] !== 1) continue;
    const code = es[i + 3];
    if (code === 0xb3) {
      if (pendingStart < 0) pendingStart = i;
      const rateCode = es[i + 7] & 0x0f;
      frameTicks = FRAME_TICKS[rateCode] ??
        fail(`frame_rate_code ${rateCode}は扱わない`);
    } else if (code === 0xb8) {
      if (pendingStart < 0) pendingStart = i;
      nextIsGopStart = true;
    } else if (code === 0x00) {
      const temporalReference = (es[i + 4] << 2) | (es[i + 5] >> 6);
      const codingType = (es[i + 5] >> 3) & 0x07;
      const dts = DTS_BASE + units.length * frameTicks;
      if (nextIsGopStart) gopDts = dts;
      const pts = gopDts + (temporalReference + 1) * frameTicks;
      const isB = codingType === 3;
      if (isB && pts !== dts) {
        fail(`Bピクチャ#${units.length}のPTS ${pts} != DTS ${dts}`);
      }
      units.push({ dts, isB, pts, start: pendingStart < 0 ? i : pendingStart });
      pendingStart = -1;
      nextIsGopStart = false;
    }
  }
  if (units.length === 0) fail("ピクチャが無い");
  return units;
}

/** PESヘッダーのPTS/DTS 5バイト。prefixは PTSのみ=0x2、PTS(DTS付き)=0x3、DTS=0x1 */
export function timestamp(prefix: number, ticks: number): number[] {
  return [
    (prefix << 4) | ((Math.floor(ticks / 2 ** 30) & 0x07) << 1) | 1,
    (ticks >>> 22) & 0xff,
    ((ticks >>> 14) & 0xfe) | 1,
    (ticks >>> 7) & 0xff,
    ((ticks << 1) & 0xfe) | 1,
  ];
}
