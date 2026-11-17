// 曲・譜面の一覧のHTMLと、その元データのJSONを書く。I/Oだけを行う。

import { dirname } from "@std/path";

/**
 * データの作成とファイルの中身の生成は呼び出し側が渡す。
 * 配置が通らなくても読めるよう、配置計画より前に呼ぶ。
 */
export function writeSongList<Data>(
  makeData: () => Data,
  render: (data: Data) => { html: string; json: string },
  report: { data: string; html: string },
): void {
  const { html, json } = render(makeData());
  Deno.mkdirSync(dirname(report.html), { recursive: true });
  Deno.writeTextFileSync(report.html, html);
  Deno.writeTextFileSync(report.data, json);
}
