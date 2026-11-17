// 全曲リストのフォルダー(data/song_catalog/)を読む。判断は含まない。

export const CATALOG_DIRECTORY = "data/song_catalog/";

export function catalogFileNames(): string[] {
  return Array.from(Deno.readDirSync(CATALOG_DIRECTORY), (entry) => entry.name);
}

export function readCatalogFile(name: string): string {
  return Deno.readTextFileSync(CATALOG_DIRECTORY + name);
}

/** `catalogPathsOf`が返すパスのリストを読む */
export const readCatalogText = (path: string): string =>
  Deno.readTextFileSync(path);

export const writeCatalogText = (path: string, text: string): void =>
  Deno.writeTextFileSync(path, text);

/** 音とオーバーレイをPB原盤の曲と共有する曲の表 */
export const SHARED_ASSETS_PATH = "data/shared_assets.csv";

export const readSharedAssetsText = (): string =>
  Deno.readTextFileSync(SHARED_ASSETS_PATH);

/** ANOTHERで使い分ける素材の表 */
export const ANOTHER_SWITCHES_PATH = "data/another_switches.csv";

export const readAnotherSwitchesText = (): string =>
  Deno.readTextFileSync(ANOTHER_SWITCHES_PATH);

/** ムービーの別名の表 */
export const MOVIE_ALIASES_PATH = "data/movie_alias.csv";

export const readMovieAliasesText = (): string =>
  Deno.readTextFileSync(MOVIE_ALIASES_PATH);
