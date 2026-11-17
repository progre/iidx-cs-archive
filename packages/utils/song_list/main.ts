// ビルドが書いた曲リストのJSONから、曲リストのHTMLだけを書き直す。
// 実行: deno run --allow-read=. --allow-write=build packages/utils/song_list/main.ts

import { songListHtmlOfJson } from "@csa/report-song-list";

const JSON_PATH = "build/song_list.json";
const HTML_PATH = "build/song_list.html";

async function main(): Promise<void> {
  await Deno.writeTextFile(
    HTML_PATH,
    songListHtmlOfJson(await Deno.readTextFile(JSON_PATH)),
  );
  console.log(`song list: ${HTML_PATH}`);
}

if (import.meta.main) {
  await main();
}
