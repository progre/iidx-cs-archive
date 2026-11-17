// 全曲リストを扱う。置き場は次のとおり。
// - file/: 全曲リストのファイルとフォルダーの読み書き
// - file/tables/: data/ にあるCSVの表(共有、ムービーの別名など)の読み込み
// - match.ts: 曲DBの曲との照合
// - review.ts: 照合結果の報告と書き換え
// - levels/: 難易度の欄。譜面スロットの並びと、原作の難易度の読み出しを扱う。
//   ゲームに反映されない難易度の値を見つけ、全曲リストに記録する処理もここにある
// - entry/: 曲DBエントリーのレベル欄へ書く難易度の選択
// - catalog.ts: 全世代の全曲リストと、曲番号から行を引く表
export { songCatalog, type SongCatalogPorts } from "./catalog.ts";
export * from "./levels/writing/mod.ts";
export * from "./file/mod.ts";
export {
  catalogGroupsOf,
  catalogKeyOf,
  withGroupSubtitles,
} from "./file/groups/mod.ts";
export * from "./file/groups/mod.ts";
export * from "./file/tables/mod.ts";
export * from "./levels/mod.ts";
export * from "./match.ts";
export * from "./review.ts";
