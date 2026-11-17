// 切り出したバイト列を書くファイルの開閉。I/Oだけを行う。

export interface SliceOutput extends Disposable {
  write(bytes: Uint8Array): Promise<void>;
}

/** 既にあれば中身を空にして開く */
export async function openSliceOutput(path: string): Promise<SliceOutput> {
  const file = await Deno.open(path, {
    create: true,
    truncate: true,
    write: true,
  });
  return {
    async write(bytes) {
      let written = 0;
      while (written < bytes.length) {
        written += await file.write(bytes.subarray(written));
      }
    },
    [Symbol.dispose]: () => file.close(),
  };
}
