// 世代のbundleを書くファイルの作成と追記。I/Oだけを行う。

export const makeDirectory = (directory: string): void =>
  Deno.mkdirSync(directory, { recursive: true });

/** 最初に書くときに開き、既にあれば中身を空にする。1度も書かなければ作らない */
export class BundleFile {
  #file: Deno.FsFile | null = null;

  constructor(private readonly path: string) {}

  async append(bytes: Uint8Array): Promise<void> {
    this.#file ??= await Deno.open(this.path, {
      create: true,
      truncate: true,
      write: true,
    });
    let done = 0;
    while (done < bytes.length) {
      done += await this.#file.write(bytes.subarray(done));
    }
  }

  close(): void {
    this.#file?.close();
  }
}
