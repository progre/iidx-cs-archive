// 曲DBの5枠が指すanimationを、絵のあるframeの列にして返す。枠0が判定、枠1〜4が押下で、
// PBの枠の割り当てと同じである。

import {
  BIAS,
  findTables,
  FRAME_STRIDE,
  groupsOfAnimation,
  type Sprite,
  spritesOfGroup,
} from "../legacy/mod.ts";

/** 判定では出さない印。枠0の補助欄に入る(原盤の判定表示処理が弾く) */
const NO_JUDGE = 573;
/** 補助欄を持つのは1枠6バイトの世代だけ */
const TRIPLE_BYTES = 6;

/**
 * 隅に8x8のspriteを置くだけのframeは、1周の残りを埋めるだけで何も見えない。
 * 絵のあるframeはこれより大きいspriteを持つ。
 */
const isPicture = (sprite: Sprite) => sprite.w > 8 || sprite.h > 8;

export interface OverlayFrame {
  /** 1/60秒刻みの表示長 */
  length: number;
  /** 先が奥 */
  sprites: Sprite[];
}

export interface OverlaySlot {
  animation: number;
  frames: OverlayFrame[];
  /** 曲DBの枠の位置。0が判定、1〜4が押下 */
  slot: number;
}

export interface LegacySong {
  /** 曲DBの枠に種別が入っている。中身を作れたかは`slots`で見る */
  hasSlots: boolean;
  slots: OverlaySlot[];
}

export interface LegacyOverlay {
  /** 使う枠の数。空枠を含む */
  slotCount: number;
  songOf(songId: number): LegacySong;
}

/** 曲DBから呼び出し側が取り出す枠。曲DBの読み方はこの世代の外にある */
export interface LegacyOverlaySlots {
  /** 1枠のバイト数と枠数 */
  layout: { bytes: number; count: number };
  /** 枠ごとの`[種別, animation, 補助]`。枠を持たない曲はnull */
  slotsOf(songId: number): readonly (readonly number[])[] | null;
}

/** 曲DBと世代の定義から枠を読む。枠の欄を持たない世代は例外にする */
export function readLegacyOverlayOf(
  generation: string,
  elf: Uint8Array,
  layout: LegacyOverlaySlots["layout"] | null,
  db: {
    record(songId: number): {
      overlay: { slots: ReturnType<LegacyOverlaySlots["slotsOf"]> };
    };
  },
): LegacyOverlay {
  if (layout == null) {
    throw new Error(`${generation}はlegacyのオーバーレイを持たない`);
  }
  return readLegacyOverlay(generation, elf, {
    layout,
    slotsOf: (songId) => db.record(songId).overlay.slots,
  });
}

export function readLegacyOverlay(
  generation: string,
  elf: Uint8Array,
  songs: LegacyOverlaySlots,
): LegacyOverlay {
  const layout = songs.layout;
  const tables = findTables(elf, BIAS[generation]);
  if (tables === null) throw new Error(`${generation}の表が見つからない`);
  const view = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const framesOf = (animation: number) => {
    const start = view.getUint16(tables.animations + animation * 4, true);
    return groupsOfAnimation(elf, tables, animation)
      .map((group, i) => ({
        length: view.getUint16(
          tables.frames + (start + i) * FRAME_STRIDE + 2,
          true,
        ),
        sprites: spritesOfGroup(elf, tables, group),
      }))
      .filter((frame) => frame.sprites.some(isPicture));
  };
  return {
    slotCount: layout.count,
    songOf(songId) {
      const values = songs.slotsOf(songId) ?? [];
      const slots: OverlaySlot[] = [];
      let hasSlots = false;
      for (const [slot, [kind, animation, aux]] of values.entries()) {
        if (kind === 0) continue;
        hasSlots = true;
        if (
          slot === 0 && layout.bytes === TRIPLE_BYTES && aux === NO_JUDGE
        ) continue;
        if (animation < 1 || animation >= tables.animationCount) continue;
        const frames = framesOf(animation);
        if (frames.length > 0) slots.push({ animation, frames, slot });
      }
      return { hasSlots, slots };
    },
  };
}

/**
 * 原作では、次に鍵盤を押すか判定が出ると表示を作り直すので、表示長255の frame は長く残らない。
 * PB は再生中の枠を割り込ませないので、そのまま写すと約4秒残る
 */
const HOLD = 255;

export const hasHoldFrame = (slots: readonly OverlaySlot[]): boolean =>
  slots.some((slot) => slot.frames.some((frame) => frame.length === HOLD));

/** 表示長255の frame を`holdFrames`の長さにする */
export const withHoldFrames = (
  slots: readonly OverlaySlot[],
  holdFrames: number,
): OverlaySlot[] =>
  slots.map((slot) => ({
    ...slot,
    frames: slot.frames.map((frame) =>
      frame.length === HOLD ? { ...frame, length: holdFrames } : frame
    ),
  }));

/**
 * 枠を1つも作れなかった曲のうち、レイヤーを出すはずの曲か。
 * 曲DBの枠か`IFs`を持つ曲は、レイヤーを出すはずの曲である。
 */
export const isLostOverlay = (song: LegacySong, hasIfs: boolean): boolean =>
  song.slots.length === 0 && (song.hasSlots || hasIfs);
