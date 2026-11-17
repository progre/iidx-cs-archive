// 周回で書いたbundleから、残す範囲だけを別のファイルへ写す。I/Oだけを行う。
// 周回のbundleは書き換えない。次のビルドの周回が使い回すためである。

/** 残す範囲だけを、書いた順に`output`へ写す。残す範囲が無ければ何もしない */
export function writeKeptBundle(
  path: string,
  kept: readonly { offset: number; size: number }[],
  output: string,
): void {
  if (kept.length === 0) {
    return;
  }
  const temporary = output + ".tmp";
  using source = Deno.openSync(path, { read: true });
  using file = Deno.openSync(temporary, {
    create: true,
    truncate: true,
    write: true,
  });
  for (const { offset, size } of kept) {
    const bytes = new Uint8Array(size);
    source.seekSync(offset, Deno.SeekMode.Start);
    let read = 0;
    while (read < size) {
      const count = source.readSync(bytes.subarray(read));
      if (count === null) {
        throw new Error(`${path}の範囲が足りない: ${offset} + ${size}`);
      }
      read += count;
    }
    let written = 0;
    while (written < size) {
      written += file.writeSync(bytes.subarray(written));
    }
  }
  Deno.renameSync(temporary, output);
}
