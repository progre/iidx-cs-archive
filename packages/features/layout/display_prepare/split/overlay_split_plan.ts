// 上限に収まらないパッケージを、場面ごとに何本へどう分けるかを選ぶ。
// sheetは詰め直さず丸ごと選ぶので、複数の場面が使うsheetは各本へ重複して入る。

import { SEC } from "@csa/core";

/** 記述子は{u32 展開後長, u32 圧縮長}で、metadataとsheetのぶんが並ぶ */
const DESCRIPTOR_BYTES = 8;
/** 組は8枠なので場面も8を超えない。総当たりの規模もこれで決まる */
const MAX_SCENES = 8;

/**
 * 1本のセクタ数の上限。ELFの読み込み領域は3,600セクタあるが、演奏中に他の読み込みが
 * 同じ領域を借りるかを確かめていないので、PB自身が使っている最大までに抑える。
 */
export const OVERLAY_PACKAGE_SECTOR_LIMIT = 3244;

export interface SplitScene {
  animation: number;
  sheets: ReadonlySet<number>;
}

/** 圧縮後の長さ(記述子の値)。metadataは書き換えで縮むので見積もりは元の値で足りる */
export interface SplitSizes {
  /** `.if`のヘッダーの長さ。形式は`containers/if_container`が定めるので、呼び出し元が渡す */
  headerBytes: number;
  metadata: number;
  sheets: readonly number[];
}

export interface SplitPart {
  animations: number[];
  sectors: number;
  sheets: number[];
}

export function packageSectors(
  sheets: Iterable<number>,
  sizes: SplitSizes,
): number {
  let bytes = sizes.headerBytes + DESCRIPTOR_BYTES + sizes.metadata;
  for (const sheet of sheets) {
    const size = sizes.sheets[sheet];
    if (size === undefined) throw new Error(`sheet ${sheet} の記述子が無い`);
    bytes += DESCRIPTOR_BYTES + size;
  }
  return Math.ceil(bytes / SEC);
}

/** 場面の組分けを重複無く並べる。i番目の場面の値が本の番号で、0から順に使う */
function* groupings(count: number, maxParts: number): Generator<number[]> {
  const current: number[] = new Array(count).fill(0);
  function* step(at: number, used: number): Generator<number[]> {
    if (at === count) {
      yield current;
      return;
    }
    for (let part = 0; part <= Math.min(used, maxParts - 1); part++) {
      current[at] = part;
      yield* step(at + 1, Math.max(used, part + 1));
    }
  }
  yield* step(0, 0);
}

function partsOf(
  grouping: readonly number[],
  scenes: readonly SplitScene[],
  sizes: SplitSizes,
): SplitPart[] {
  const groups: { animations: number[]; sheets: Set<number> }[] = [];
  grouping.forEach((part, at) => {
    const found = groups[part] ??= { animations: [], sheets: new Set() };
    found.animations.push(scenes[at].animation);
    for (const sheet of scenes[at].sheets) found.sheets.add(sheet);
  });
  return groups.map((group) => ({
    animations: group.animations,
    sectors: packageSectors(group.sheets, sizes),
    sheets: [...group.sheets].sort((a, b) => a - b),
  }));
}

/**
 * 最少の本数を優先し、同数なら最大の本が最小になる分け方を選ぶ。
 * 引数`maxParts`は、曲の一覧で使える残りの枠の数である。呼び出し元が数えて渡す。
 */
export function planOverlaySplit(
  scenes: readonly SplitScene[],
  sizes: SplitSizes,
  maxParts: number,
  limit: number = OVERLAY_PACKAGE_SECTOR_LIMIT,
): SplitPart[] {
  if (scenes.length === 0) {
    throw new Error("場面が無いパッケージは分けられない");
  }
  if (scenes.length > MAX_SCENES) {
    throw new Error(`場面が${scenes.length}件で総当たりの上限を超える`);
  }
  for (const scene of scenes) {
    const sectors = packageSectors(scene.sheets, sizes);
    if (sectors > limit) {
      throw new Error(
        `animation ${scene.animation} だけで${sectors} sectorsあり分けられない`,
      );
    }
  }
  let best: SplitPart[] | undefined;
  let bestMax = 0;
  for (const grouping of groupings(scenes.length, maxParts)) {
    const count = Math.max(...grouping) + 1;
    if (best !== undefined && count > best.length) continue;
    const parts = partsOf(grouping, scenes, sizes);
    const max = Math.max(...parts.map((part) => part.sectors));
    if (max > limit) continue;
    if (best === undefined || parts.length < best.length || max < bestMax) {
      best = parts;
      bestMax = max;
    }
  }
  if (best === undefined) {
    throw new Error(`${maxParts}本までに収まる分け方が無い`);
  }
  return best;
}
