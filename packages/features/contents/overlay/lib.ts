// 曲中オーバーレイ(演奏画面のレイヤー)の欄の読み書き。
// 世代別の読み手は read/ が持つ。PB形式の書き手は write/ が持つ。
// 読み込み上限に収める分割は split/ が持つ。本体は中立のモデルを置く。
export * from "./read/mod.ts";
export * from "./split/mod.ts";
export * from "./write/mod.ts";

/** 組が指すパッケージは`packages`の添字で持つ */
export interface OverlayPair {
  animation: number;
  packageIndex: number;
}

/** 曲1件のオーバーレイ。パッケージの識別子の型は呼び手が決める */
export interface SongOverlayModel<Package> {
  packages: readonly Package[];
  /** 枠の位置を保った組。空枠はnull */
  pairs: readonly (OverlayPair | null)[];
}
