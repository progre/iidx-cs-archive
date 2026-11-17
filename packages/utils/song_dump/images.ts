import { extname, join } from "@std/path";
import { type Definition, DEFINITIONS } from "@csa/selection-definitions";
import { openIso9660File } from "@csa/containers-disc";

export interface GenerationImage {
  definition: Definition;
  path: string;
}

const IMAGE_EXTENSIONS = [".bin", ".iso"];

function imagePathsIn(dir: string, entries: Deno.DirEntry[]): string[] {
  return entries
    .filter((entry) =>
      entry.isFile &&
      IMAGE_EXTENSIONS.includes(extname(entry.name).toLowerCase())
    )
    .map((entry) => join(dir, entry.name));
}

function subDirsIn(dir: string, entries: Deno.DirEntry[]): string[] {
  return entries
    .filter((entry) => entry.isDirectory || entry.isSymlink)
    .map((entry) => join(dir, entry.name));
}

/** <ISOフォルダー>の直下と、その1階層下にあるイメージを集める。 */
async function listImages(isoDir: string): Promise<string[]> {
  const entries = await Array.fromAsync(Deno.readDir(isoDir));
  const images = imagePathsIn(isoDir, entries);
  const subDirs = subDirsIn(isoDir, entries);
  const subDirImages = await Promise.all(subDirs.map(async (subDir) => {
    const subDirEntries = await Array.fromAsync(Deno.readDir(subDir));
    return imagePathsIn(subDir, subDirEntries);
  }));
  return images.concat(subDirImages.flat()).sort();
}

/** 1枚のイメージをGENERATIONSのelfと突き合わせ、一致した世代を採用する */
async function matchGeneration(path: string): Promise<GenerationImage | null> {
  using disc = await openIso9660File(path);
  const files = await disc.collectFiles();
  const definition = DEFINITIONS
    .find((d) => files.has(d.elf.fileName.toUpperCase()));
  return definition == null ? null : { definition, path };
}

/** <ISOフォルダー>のイメージをGENERATIONSのelfで世代へ引き当て、一致したものだけ採用する */
export async function eachGenerationIsos(
  isoDir: string,
): Promise<GenerationImage[]> {
  const images = await listImages(isoDir);
  const matched = await Promise.all(images.map(matchGeneration));
  return matched.filter((image) => image != null);
}
