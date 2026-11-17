// 目視レビュー用に、変換済みPSSを1本のmp4へ写す ffmpeg の指示。I/Oは行わない。

// 目視レビュー用に出力するファイルの名前。

export const safeName = (title: string): string =>
  title.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");

/** mp4のファイル名。曲名が記号だけなら`untitled`にする */
export const mp4NameOf = (
  generation: string,
  fileName: string,
  title: string,
): string =>
  `${generation}_${fileName.slice(0, -4)}_${safeName(title) || "untitled"}.mp4`;

/** 変換済みPSSの隣に置く、検査結果と採用曲の`.json`のパス */
export const metaPathOf = (directory: string, fileName: string): string =>
  directory + "/" + fileName + ".json";

/** 映像は再圧縮せず、容器だけ替える */
export function mp4JobOf(
  outDir: string,
  generation: string,
  directory: string,
  fileName: string,
  title: string,
): { args: string[]; output: string } {
  const output = `${outDir}/${mp4NameOf(generation, fileName, title)}`;
  return {
    args: ["-i", directory + "/" + fileName, "-c", "copy", output],
    output,
  };
}
