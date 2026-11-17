// legacy(3rd〜8th)のELFから、表示の4表(animation・frame・組・sprite)を割り出す。
// 4表を引数に渡す関数が lui/addiu で組み立てる並びを探し、組表の合計が sprite の
// 件数と一致することで検算する。

/** 曲DBの題名欄と同じ基準値。ELF offset + これ = アドレス */
export const BIAS: Record<string, number> = {
  "3rd": 0xff000,
  "4th": 0xff000,
  "5th": 0xff000,
  "6th": 0xff000,
  "7th": 0xfff80,
  "8th": 0xfff80,
};

export const FRAME_STRIDE = 10;
export const SPRITE_STRIDE = 16;
const WINDOW = 24;

export interface Tables {
  animations: number;
  animationCount: number;
  frames: number;
  frameCount: number;
  groups: number;
  sprites: number;
  spriteCount: number;
}

/** lui と addiu/ori の対で組み立てる定数を、命令の位置ごとに拾う */
function builtAddresses(elf: Uint8Array): { at: number; value: number }[] {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const found: { at: number; value: number }[] = [];
  const count = (elf.length >> 2) - 8;
  for (let i = 0; i < count; i++) {
    const w = view.getUint32(i * 4, true);
    if (w >>> 26 !== 0x0f) continue;
    const high = w & 0xffff;
    const rt = (w >>> 16) & 0x1f;
    for (let k = 1; k <= 8; k++) {
      const n = view.getUint32((i + k) * 4, true);
      const op = n >>> 26;
      if ((op !== 0x09 && op !== 0x0d) || ((n >>> 21) & 0x1f) !== rt) continue;
      const low = n & 0xffff;
      const value = op === 0x0d
        ? (high << 16) | low
        : ((high << 16) + (low >= 0x8000 ? low - 0x10000 : low)) >>> 0;
      found.push({ at: i, value });
      break;
    }
  }
  return found;
}

/** 累積表{u16 開始, u16 個数}の合計が総数と合うかで表の組を検算する */
function validate(
  view: DataView,
  animations: number,
  frames: number,
  sprites: number,
  groups: number,
): Tables | null {
  const spriteCount = (groups - sprites) / SPRITE_STRIDE;
  const frameCount = Math.floor((sprites - frames) / FRAME_STRIDE);
  const animationCount = (frames - animations) / 4;
  if (!Number.isInteger(spriteCount) || spriteCount < 1000) return null;
  if (animationCount < 500 || frameCount < 1000) return null;
  const total = (at: number, n: number) =>
    view.getUint16(at + (n - 1) * 4, true) +
    view.getUint16(at + (n - 1) * 4 + 2, true);
  const groupCount = Math.floor((view.byteLength - groups) / 4);
  let entries = 0;
  while (
    entries < groupCount &&
    view.getUint16(groups + entries * 4, true) +
          view.getUint16(groups + entries * 4 + 2, true) ===
      view.getUint16(groups + entries * 4 + 4, true)
  ) entries++;
  if (total(groups, entries + 1) !== spriteCount) return null;
  if (total(animations, animationCount) > frameCount + 1) return null;
  return {
    animations,
    animationCount,
    frames,
    frameCount,
    groups,
    sprites,
    spriteCount,
  };
}

/**
 * 4つの表アドレスを続けて組み立てている場所を探す。
 * 検算を通る組は世代ごとに1つしかないので、最初に見つけたものを採る。
 */
export function findTables(elf: Uint8Array, bias: number): Tables | null {
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const built = builtAddresses(elf);
  for (let i = 0; i + 3 < built.length; i++) {
    const four = built.slice(i, i + 4);
    if ((four.at(3)?.at ?? 0) - (four.at(0)?.at ?? 0) > WINDOW) continue;
    const offsets = four.map((b) => b.value - bias);
    if (offsets.some((o) => o < 0 || o >= elf.length)) continue;
    const sorted = offsets.every((o, k) =>
      k === 0 || o > (offsets.at(k - 1) ?? 0)
    );
    if (!sorted) continue;
    const tables = validate(
      view,
      offsets.at(0) ?? 0,
      offsets.at(1) ?? 0,
      offsets.at(2) ?? 0,
      offsets.at(3) ?? 0,
    );
    if (tables !== null) return tables;
  }
  return null;
}
