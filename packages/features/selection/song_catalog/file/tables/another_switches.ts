// ANOTHERで使い分ける素材の表(`data/another_switches.csv`)を読む。
// この表には、ANOTHERのときだけ別のムービー・オーバーレイ・曲名カードを使う曲を載せる。
// 原作では、曲DBのデータではなく、プログラムの中の曲番号の比較で切り替えている。

import type { AnotherSwitchRow } from "@csa/core";
export type { AnotherSwitchRow };
import { parse } from "@std/csv";

const HEADER = ["generation", "title", "video", "overlay", "title_card"];

function numberOf(cell: string, name: string, line: number): number | null {
  if (cell === "") {
    return null;
  }
  if (!/^\d+$/.test(cell)) {
    throw new Error(`line ${line}: ${name}は0以上の整数`);
  }
  return Number(cell);
}

export function parseAnotherSwitches(text: string): AnotherSwitchRow[] {
  const [header, ...rows] = parse(text);
  if (header?.join(",") !== HEADER.join(",")) {
    throw new Error(`line 1: unexpected header: ${header?.join(",")}`);
  }
  return rows.map((cells, index) => {
    const line = index + 2;
    const [generation, title, video, overlay, titleCard] = cells;
    if (cells.length !== HEADER.length || generation === "" || title === "") {
      throw new Error(`line ${line}: 5列で書き、generationとtitleは空にしない`);
    }
    if (overlay !== "" && overlay !== "another") {
      throw new Error(`line ${line}: overlayの値は、anotherか空にする`);
    }
    if (video === "" && overlay === "" && titleCard === "") {
      throw new Error(
        `line ${line}: video・overlay・title_cardのどれかに値を書く`,
      );
    }
    return {
      generation,
      line,
      overlayOnlyAnother: overlay === "another",
      title,
      titleCardSprite: numberOf(titleCard, "title_card", line),
      video: numberOf(video, "video", line),
    };
  });
}
