// 周回で書いた音のbundleの記録を読み書きする。I/Oだけを行う。

/** bundleに書いた音の並びと変換の結果。次のビルドの周回は、並びが同じならbundleを使い回す */
export interface SoundLapRecord<O> {
  /**
   * 書き終えたときのbundleの大きさ。
   * 次のビルドは、この値と今のbundleの大きさを比べる。違えば使い回さない
   */
  bundleSize: number;
  /** 変換した音の鍵を、書いた順に並べたもの */
  keys: string[];
  occurrences: O[];
}

/** 記録が無ければ`undefined` */
export function readSoundLapRecord<O>(
  path: string,
): SoundLapRecord<O> | undefined {
  try {
    return JSON.parse(Deno.readTextFileSync(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

export function writeSoundLapRecord<O>(
  path: string,
  record: SoundLapRecord<O>,
): void {
  Deno.writeTextFileSync(path, JSON.stringify(record));
}

/** 記録を消す。bundleを書き始める前に消し、書き終えるまで記録が残らないようにする */
export function removeSoundLapRecord(path: string): void {
  try {
    Deno.removeSync(path);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

/** ファイルの大きさ。ファイルが無ければ0 */
export function bundleSizeOf(path: string): number {
  try {
    return Deno.statSync(path).size;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return 0;
    }
    throw error;
  }
}
