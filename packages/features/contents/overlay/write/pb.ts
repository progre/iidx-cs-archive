// PB形式の曲中オーバーレイ欄。曲DB`+0x64`の一覧(u16×8)と`+0x74`の組(u16×16)を組む。
// 枠0は判定、枠1〜7は押下の抽選で、再生側は枠1〜7の
// 有効な組を詰め直してから引く。写す側も枠0を据え置き、枠1以降を順に詰める。
import type { SongOverlayModel } from "../lib.ts";
import type { OverlayLayout } from "../read/mod.ts";

/** 一覧と組の枠数。PBはどちらも8枠 */
export const PB_PACKAGE_COUNT = 8;
export const PB_OVERLAY_PAIR_COUNT = 8;
/** 空枠。s16で負ならローダーも再生側も読み飛ばす */
const EMPTY = 0xff;

export interface PbOverlayFields {
  /** `+0x64`。u16×8 */
  packages: Uint8Array;
  /** `+0x74`。{u16 animation, u16 DATA1 index}×8 */
  pairs: Uint8Array;
}

const filled = (bytes: number) => new Uint8Array(bytes).fill(EMPTY);

export function encodePbOverlay<Package>(
  overlay: SongOverlayModel<Package>,
  data1IndexOf: (item: Package) => number,
): PbOverlayFields {
  if (overlay.packages.length > PB_PACKAGE_COUNT) {
    throw new Error(`オーバーレイのパッケージが${overlay.packages.length}本`);
  }
  const indexOf = (packageIndex: number) => {
    const item = overlay.packages[packageIndex];
    if (item === undefined) {
      throw new Error(`オーバーレイの組が一覧に無い${packageIndex}を指す`);
    }
    return data1IndexOf(item);
  };
  const packages = filled(PB_PACKAGE_COUNT * 2);
  const packagesView = new DataView(packages.buffer);
  overlay.packages.forEach((item, slot) =>
    packagesView.setUint16(slot * 2, data1IndexOf(item), true)
  );
  const drawn = overlay.pairs.slice(1).filter((pair) => pair !== null);
  if (drawn.length > PB_OVERLAY_PAIR_COUNT - 1) {
    throw new Error(`オーバーレイの組が${drawn.length + 1}本`);
  }
  const pairs = filled(PB_OVERLAY_PAIR_COUNT * 4);
  const pairsView = new DataView(pairs.buffer);
  [overlay.pairs[0] ?? null, ...drawn].forEach((pair, slot) => {
    if (pair === null) return;
    pairsView.setUint16(slot * 4, pair.animation, true);
    pairsView.setUint16(slot * 4 + 2, indexOf(pair.packageIndex), true);
  });
  return { packages, pairs };
}

/** エントリーにある一覧と組の欄を、そのまま写す */
export function copyPbOverlayFields(
  layout: OverlayLayout,
  entry: Uint8Array,
): PbOverlayFields {
  if (layout.kind !== "sheet") {
    throw new Error("PBのオーバーレイ欄の配置が一覧と組の形でない");
  }
  return {
    packages: entry.slice(
      layout.packagesOffset,
      layout.packagesOffset + PB_PACKAGE_COUNT * 2,
    ),
    pairs: entry.slice(
      layout.pairsOffset,
      layout.pairsOffset + PB_OVERLAY_PAIR_COUNT * 4,
    ),
  };
}
