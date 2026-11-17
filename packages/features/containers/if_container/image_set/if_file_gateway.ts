// 組んだ`.if`を、フォルダーごと作って書く。I/Oだけを行う。

export function writeIfFile(
  directory: string,
  path: string,
  bytes: Uint8Array,
): void {
  Deno.mkdirSync(directory, { recursive: true });
  Deno.writeFileSync(path, bytes);
}

/** 合成した画像セットを`<directory>/<data1Index>.if`に書き、書いたファイルを返す */
export function writeImageSetFile(
  directory: string,
  data1Index: number,
  bytes: Uint8Array,
): { data1Index: number; path: string; size: number } {
  const path = `${directory}/${data1Index}.if`;
  writeIfFile(directory, path, bytes);
  return { data1Index, path, size: bytes.length };
}
