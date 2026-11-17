// 分ける前の本の読み込みと、分けた本の書き出し。I/Oだけを行う。

export const readSourceFile = (path: string): Uint8Array =>
  Deno.readFileSync(path);

/** 書く本が無くても、フォルダーは作る */
export function writePartFiles(
  directory: string,
  parts: readonly { bytes: Uint8Array; path: string }[],
): void {
  Deno.mkdirSync(directory, { recursive: true });
  parts.forEach((part) => Deno.writeFileSync(part.path, part.bytes));
}
