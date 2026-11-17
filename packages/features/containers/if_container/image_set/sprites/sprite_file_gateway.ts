// 素材の画像セットから取り出したspriteを、中間ファイルに書き、読む。I/Oだけを行う。

import { dirname } from "@std/path";
import {
  type ExtractedSprites,
  parseExtractedSprites,
  serializeExtractedSprites,
} from "./extracted_sprites.ts";

export function writeExtractedSprites(
  path: string,
  sprites: ExtractedSprites,
): void {
  Deno.mkdirSync(dirname(path), { recursive: true });
  Deno.writeFileSync(path, serializeExtractedSprites(sprites));
}

export function readExtractedSprites(path: string): ExtractedSprites {
  return parseExtractedSprites(Deno.readFileSync(path));
}
