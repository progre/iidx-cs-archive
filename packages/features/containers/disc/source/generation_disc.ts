// 世代から原盤のイメージファイルを開く。原盤は`resources/<作品フォルダー>/`に置く。

import type { DiscImage } from "@csa/core";
import { FileDiscImage, findImage } from "../image/mod.ts";
import { type DirEnt, Iso9660 } from "../volume/mod.ts";

/** 世代 ID → 作品フォルダー名。表は`readDiscFolders`で読む */
export type DiscFolders = Readonly<Record<string, string>>;

/** 世代と作品フォルダーの表。リポジトリーのルートからの相対で読む */
const DISC_FOLDERS_PATH = "config/discs.json";

export const readDiscFolders = (): DiscFolders =>
  JSON.parse(Deno.readTextFileSync(DISC_FOLDERS_PATH));
/** 世代の原盤を、バイト列を読む口として開く */
export async function openGenerationImage(
  folders: DiscFolders,
  generation: string,
): Promise<DiscImage> {
  const folder = folders[generation];
  if (folder === undefined) {
    throw new Error(`未登録の世代: ${generation}`);
  }
  return await FileDiscImage.open(await findImage(`resources/${folder}`));
}

export async function openGenerationIso(
  folders: DiscFolders,
  generation: string,
): Promise<Iso9660> {
  return new Iso9660(await openGenerationImage(folders, generation));
}

/** 開いた原盤と、そのファイル一覧。一覧の各項目は、ディレクトリレコードの位置も持つ */
export interface OpenedDisc {
  disc: Iso9660;
  files: Map<string, DirEnt>;
}

/** 世代の原盤を開く。イメージファイルとドライブのどちらから読むかは、この関数で決まる */
export type DiscOpener = (generation: string) => Promise<OpenedDisc>;

/** 世代の原盤を開き、ファイル一覧も読む */
export async function openGenerationDisc(
  folders: DiscFolders,
  generation: string,
): Promise<OpenedDisc> {
  const disc = await openGenerationIso(folders, generation);
  return { disc, files: await disc.collectFiles() };
}

/** 原盤のイメージファイルから読む。ファイルの場所は`config/discs.json`で決まる */
export const imageFileOpener =
  (folders: DiscFolders): DiscOpener => (generation) =>
    openGenerationDisc(folders, generation);
