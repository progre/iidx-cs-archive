// 曲リストのデータからHTMLを1枚組む。見た目は templates/ と assets/ にあり、ここはそれらを束ねるだけにする。

import alpineScript from "alpinejs/dist/cdn.min.js" with { type: "text" };
import bootstrapCss from "bootstrap/dist/css/bootstrap.min.css" with {
  type: "text",
};
import Handlebars from "handlebars";
import type { SongListData } from "../types.ts";
import { pageView } from "./page.ts";

const ROOT = (import.meta.dirname ?? ".") + "/..";

const read = (path: string) => Deno.readTextFileSync(ROOT + "/" + path);

/**
 * ブラウザ向けのAlpineとBootstrapのCSSは、生成物を1ファイルに保つためHTMLへ埋め込む。
 * `assets/style.css`はBootstrapより後に置き、Bootstrapの指定を上書きする
 */
const styleOf = () => bootstrapCss + "\n" + read("assets/style.css");

/** 部分テンプレート。`page`から名前で呼ぶ */
const PARTIALS = [
  "header",
  "lines",
  "none",
  "refs",
  "save_order",
  "size",
  "table",
];

function newPage() {
  const handlebars = Handlebars.create();
  for (const name of PARTIALS) {
    handlebars.registerPartial(name, read("templates/" + name + ".hbs"));
  }
  return handlebars.compile(read("templates/page.hbs"));
}

let page: ReturnType<typeof newPage> | undefined;

export function pageHtml(data: SongListData): string {
  page ??= newPage();
  return page(pageView(data, styleOf(), alpineScript));
}
