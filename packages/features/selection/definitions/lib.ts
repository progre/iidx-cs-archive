// 世代ごとの原盤の定義。原盤の値をそのまま持ち、CSAを作る途中の判断は持たない。
// table.ts と definitions.csv: 実行ファイル・曲DBの配置・ファイル表と、世代の性質
// generation/: 素材世代の一覧と、世代で決まる形式
// songmap/: 曲が参照するファイルの一覧の規則と、譜面の鍵の規則
// songs/: 譜面とレベルの欄の並びと、原作がELFに直書きしている曲の組

export type {
  SingleSlot,
  SizedSlots,
  Slots,
  SongDbRecordLayout,
  TitleEncoding,
} from "@csa/core";
export * from "./generation/mod.ts";
export * from "./songmap/mod.ts";
export * from "./songs/mod.ts";
export {
  type Definition,
  DEFINITIONS,
  elfDefinitionOf,
  elfFileNameOf,
  type Era,
  type Generation,
} from "./table.ts";
