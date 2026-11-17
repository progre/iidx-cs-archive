/** 実行ファイルの中にあるファイルは実行ファイルから切り出し、他は`readFromDisc`で読む */
export async function segmentOf(
  elf: Uint8Array,
  elfName: string,
  file: {
    readonly archive: string;
    readonly offset: number;
    readonly size: number;
  },
  readFromDisc: () => Promise<Uint8Array>,
): Promise<Uint8Array> {
  return file.archive.toUpperCase() === elfName.toUpperCase()
    ? elfSegmentOf(elf, file)
    : await readFromDisc();
}

/** ELFの中のファイルの範囲。大きさが負なら末尾まで返す(既存ツールの`read(負数)`と同じ) */
export function elfSegmentOf(
  elf: Uint8Array,
  file: { readonly offset: number; readonly size: number },
): Uint8Array {
  const end = file.size < 0
    ? elf.length
    : Math.min(file.offset + file.size, elf.length);
  return elf.subarray(file.offset, end);
}
