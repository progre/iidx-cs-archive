// 全曲リストを原盤の曲DBと照合し、報告を1行ずつ出す。報告があれば終了コード1で終わる。
// `--remove-same`を付けると、原作と同じ難易度をリストから消す。書き込みには--allow-write=data/song_catalogが要る。

import { checkSongCatalog } from "./check.ts";

if (import.meta.main) {
  const lines = await checkSongCatalog(Deno.args.includes("--remove-same"));
  lines.forEach((line) => console.log(line));
  if (lines.length > 0) {
    Deno.exit(1);
  }
}
