import { createHash } from "node:crypto";

/** 原盤の一部を差し替える。`expected`が原盤と一致しなければ書かない */
export interface SourcePatch {
  expected: Uint8Array;
  name: string;
  offset: number;
  replacement: Uint8Array;
}

/** `MODULES/IOPRP310.IMG`のISO上の位置 */
export interface IopModuleFile {
  lba: number;
  size: number;
}

/** IMG内の語列を差し替える規則。原盤の語列は持たず、SHA-256で照合する */
export interface IopModulePatch {
  name: string;
  /** IMGの先頭からの位置 */
  imgOffset: number;
  wordCount: number;
  sha256: string;
  /** 原盤の語列から、差し替え後の語列を作る */
  replace(original: readonly number[]): number[];
}

export function bytesOf(list: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(list.length * 4);
  const view = new DataView(bytes.buffer);
  list.forEach((word, index) => view.setUint32(index * 4, word, true));
  return bytes;
}

export function wordsOf(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(
    { length: bytes.length / 4 },
    (_, index) => view.getUint32(index * 4, true),
  );
}

/** ISO上の差し替え範囲。呼び出し側はここを原盤から読み、`sourcePatchOf`へ渡す */
export function iopPatchRange(
  patch: IopModulePatch,
  iopModule: IopModuleFile,
): { offset: number; length: number } {
  const length = patch.wordCount * 4;
  if (patch.imgOffset + length > iopModule.size) {
    throw new Error(`IOPRP310.IMGが${patch.name}の照合位置より小さい`);
  }
  return { offset: iopModule.lba * 2048 + patch.imgOffset, length };
}

export function sourcePatchOf(
  patch: IopModulePatch,
  iopModule: IopModuleFile,
  original: Uint8Array,
): SourcePatch {
  const { offset } = iopPatchRange(patch, iopModule);
  const digest = createHash("sha256").update(original).digest("hex");
  if (digest !== patch.sha256) {
    throw new Error(`${patch.name}: 原盤の語列のハッシュが既知の値と違う`);
  }
  return {
    expected: original,
    name: patch.name,
    offset,
    replacement: bytesOf(patch.replace(wordsOf(original))),
  };
}
