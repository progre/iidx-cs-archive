// 変換済みPSSの一覧と検査結果の読み込み、mp4の出力フォルダーの作成。I/Oだけを行う。

export interface PssEntry {
  directory: string;
  fileName: string;
  generation: string;
}

export const makeDirectory = (directory: string): void =>
  Deno.mkdirSync(directory, { recursive: true });

/** `<pss dir>/<世代>/*.pss`を、ディレクトリーの列挙順に返す */
export const listPssEntries = (pssDir: string): PssEntry[] =>
  [...Deno.readDirSync(pssDir)]
    .filter((generation) => generation.isDirectory)
    .flatMap((generation) => {
      const directory = pssDir + "/" + generation.name;
      return [...Deno.readDirSync(directory)]
        .filter((entry) => entry.name.endsWith(".pss"))
        .map((entry) => ({
          directory,
          fileName: entry.name,
          generation: generation.name,
        }));
    });

export const readTitle = (metaPath: string): string =>
  JSON.parse(Deno.readTextFileSync(metaPath)).title;
