// 音とオーバーレイをPB原盤の曲と共有する曲の表(`data/shared_assets.csv`)を読む。
// 管理名に`"`や`,`が入るので、値はCSVの引用符で囲める。

import type { SharedAssetRow } from "@csa/core";
export type { SharedAssetRow };
import { parse } from "@std/csv";

const HEADER = ["generation", "title", "share"];

/** 共有の行を引くキー。`title`は全曲リストの`title`列と同じ書き方である */
export const sharedAssetKey = (generation: string, title: string): string =>
  generation + "/" + title;

export function parseSharedAssets(text: string): SharedAssetRow[] {
  const [header, ...rows] = parse(text);
  if (header?.join(",") !== HEADER.join(",")) {
    throw new Error(`line 1: unexpected header: ${header?.join(",")}`);
  }
  return rows.map((cells, index) => {
    const line = index + 2;
    if (cells.length !== HEADER.length || cells.some((cell) => cell === "")) {
      throw new Error(`line ${line}: 3列すべてに値を書く`);
    }
    const [generation, title, share] = cells;
    return { generation, line, share, title };
  });
}
