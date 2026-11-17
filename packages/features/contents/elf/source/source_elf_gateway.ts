// 原盤の実行ファイルの読み書き。I/Oだけを行う。

import type { SourceElfPorts } from "./source_elf_store.ts";

/** 世代の実行ファイルを`<discsDirectory>/<世代>/elf.bin`に置く */
export function fileSourceElfPorts(discsDirectory: string): SourceElfPorts {
  const directoryOf = (generation: string) => `${discsDirectory}/${generation}`;
  const pathOf = (generation: string) => `${directoryOf(generation)}/elf.bin`;
  return {
    read: (generation) => Deno.readFileSync(pathOf(generation)),
    write: (generation, elf) => {
      Deno.mkdirSync(directoryOf(generation), { recursive: true });
      Deno.writeFileSync(pathOf(generation), elf);
    },
  };
}
