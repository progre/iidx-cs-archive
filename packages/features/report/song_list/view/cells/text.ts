// 値の整形。HTMLのエスケープはテンプレートエンジンが担う。

/** 補正で変わった値の欄 */
export const correctedText = (before: string, after: string): string =>
  before + "→" + after;

/** 同じファイルかを見比べられるよう、丸めずに3桁ごとに区切る */
export const bytesText = (bytes: number): string =>
  bytes.toLocaleString("en-US");

/** ムービーの欄の`世代:番号`のうち、別名の表にあるものを`世代:別名`にする */
export const movieText = (
  text: string,
  aliases: ReadonlyMap<string, string>,
): string =>
  text.replace(/(\w+):(\d+)/g, (movie, generation: string) => {
    const alias = aliases.get(movie);
    return alias === undefined ? movie : generation + ":" + alias;
  });
