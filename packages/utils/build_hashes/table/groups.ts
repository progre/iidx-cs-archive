import { join, relative } from "@std/path";
import { INTERMEDIATE_DIRECTORY } from "@csa/core";
import { elfFileNameOf } from "@csa/selection-definitions";
import { digestOfFile } from "./iso_table.ts";
import type { DigestTable, GroupSpec } from "../types.ts";

/**
 * 記録する中間物のグループ。パスはリポジトリルートからの相対。
 * どのグループも `intermediate/` を根にし、パターンで `discs/<世代>/` と `iso/` の下を選ぶ。
 */
export const GROUPS: Record<string, GroupSpec> = {
  sound_bundles: {
    root: INTERMEDIATE_DIRECTORY,
    pattern: "^discs/[^/]+/sound(_raw)?\\.bin$",
  },
  title_cards: {
    root: INTERMEDIATE_DIRECTORY,
    pattern: "^discs/[^/]+/title_cards/",
  },
  overlays: {
    root: INTERMEDIATE_DIRECTORY,
    pattern: "^discs/[^/]+/overlays/",
  },
  csa_elf: {
    root: INTERMEDIATE_DIRECTORY,
    pattern: `^iso/${
      elfFileNameOf("pb").replaceAll(".", "\\.")
    }\\.assets-applied\\.patched$`,
  },
};

async function* filesUnder(directory: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(directory)) {
    const path = join(directory, entry.name);
    if (entry.isDirectory) {
      yield* filesUnder(path);
    } else if (entry.isFile) {
      yield path;
    }
  }
}

/** root の下で pattern に一致するファイルのハッシュ表。一致が0件なら例外にする */
export async function groupTable(spec: GroupSpec): Promise<DigestTable> {
  const pattern = new RegExp(spec.pattern);
  const paths: string[] = [];
  for await (const path of filesUnder(spec.root)) {
    const name = relative(spec.root, path).replaceAll("\\", "/");
    if (pattern.test(name)) {
      paths.push(name);
    }
  }
  if (paths.length === 0) {
    throw new Error(`${spec.root} に ${spec.pattern} に一致するファイルが無い`);
  }
  const table: DigestTable = {};
  for (const name of paths.sort()) {
    table[name] = await digestOfFile(join(spec.root, name));
  }
  return table;
}
