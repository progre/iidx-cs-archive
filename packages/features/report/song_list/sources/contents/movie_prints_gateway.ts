// 曲リストが求めたムービーの長さとハッシュを、次のビルドのために残す。I/Oだけを行う。

import { INTERMEDIATE_DIRECTORY } from "@csa/core";

const PATH = `${INTERMEDIATE_DIRECTORY}/song_list_movie_prints.json`;

/**
 * 読んだ場所を表すキー → 長さとハッシュ。
 * 長さは、末尾のゼロを除いたバイト数である。ハッシュは、先頭からその長さまでを読んで求める
 */
export type MoviePrints = Map<string, { length: number; print: string }>;

/** 記録が無ければ空にする */
export function readMoviePrints(): MoviePrints {
  try {
    const saved = JSON.parse(Deno.readTextFileSync(PATH));
    return new Map(Object.entries(saved.prints));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return new Map();
    }
    throw error;
  }
}

export function writeMoviePrints(prints: MoviePrints): void {
  Deno.writeTextFileSync(
    PATH,
    JSON.stringify({ prints: Object.fromEntries(prints) }),
  );
}

/** 中間ファイルの大きさと更新時刻。ファイルを書き直すと、キーが変わる */
export function fileStampOf(path: string): string {
  const { mtime, size } = Deno.statSync(path);
  return `${size}#${mtime?.getTime() ?? 0}`;
}
