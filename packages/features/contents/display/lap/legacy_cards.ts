// legacy(3rd〜8th)の曲名カードを、原作の絵から組み、`<discsDirectory>/<世代>/title_cards/`へ書く。
// 前のビルドのファイルがあっても、組み直して書く。

import type { Generation } from "../legacy/mod.ts";
import {
  CARD_FRAME,
  CARD_TALL,
  indexCard,
  type IndexedCard,
  resampleToFrame,
} from "../pixels/mod.ts";

/** 曲名カードを組む処理が使う、他の feature の関数。実装は app が渡す */
export interface LegacyCardPorts {
  openGeneration: (generation: string, elf: Uint8Array) => Generation;
  /** 枠に合わせた絵から`.if`を組む */
  packCard: (
    art: { height: number; width: number },
    card: IndexedCard,
  ) => Uint8Array;
  titleCardPath: (
    discsDirectory: string,
    generation: string,
    index: number,
  ) => string;
  writeTitleCard: (path: string, bytes: Uint8Array) => void;
}

/** 曲番号から曲名カードを組んで書く関数を作る。カードを組まない曲はnullを返す */
export function openLegacyCardWriter(
  ports: LegacyCardPorts,
  generation: string,
  elf: Uint8Array,
  discsDirectory: string,
): (index: number) => { path: string; size: number } | null {
  const source = ports.openGeneration(generation, elf);
  return (index) => {
    const plate = source.cardOf(index);
    if (plate === null) {
      return null;
    }
    // 横幅はそのまま縦だけ2倍にし、中央を基準に原盤の枠へ切り落とすか黒で埋める
    const art = resampleToFrame(plate, 1, CARD_TALL, CARD_FRAME);
    const bytes = ports.packCard(art, indexCard(art));
    const path = ports.titleCardPath(discsDirectory, generation, index);
    ports.writeTitleCard(path, bytes);
    return { path, size: bytes.length };
  };
}
