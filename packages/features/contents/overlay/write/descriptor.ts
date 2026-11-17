// 組を持たない曲の記述子`0x140`バイトのDATA1 index振り直し。
// 前半`+0x00`〜`+0x9C`は40欄の`{u16 animation, u16 パッケージ}`で、末尾の1欄のみ0。
// 後半`+0xA0`〜`+0x13C`はそのまま写す。

/** 記述子の長さ */
export const DESCRIPTOR_SIZE = 0x140;
const FIELD_COUNT = 40;
const FIELD_SIZE = 4;

export interface RewrittenPairlessDescriptor {
  bytes: Uint8Array;
  /** 振り直した後のDATA1 index。パッケージ表の行にも使う */
  packageIndex: number;
}

/** 非零欄が指すパッケージ番号。1種類でなければ例外 */
function sourcePackageOf(view: DataView): number {
  const packages = new Set<number>();
  for (let field = 0; field < FIELD_COUNT; field++) {
    const value = view.getUint32(field * FIELD_SIZE, true);
    if (value !== 0) packages.add(value >>> 16);
  }
  if (packages.size !== 1) {
    throw new Error(`記述子の非零欄のパッケージが${packages.size}種類`);
  }
  const [packageIndex] = packages;
  return packageIndex;
}

/** ELFのファイルオフセットから、記述子1件ぶんのバイト列を複製して読む */
export const readDescriptor = (elf: Uint8Array, offset: number): Uint8Array =>
  elf.slice(offset, offset + DESCRIPTOR_SIZE);

export function rewritePairlessDescriptor(
  descriptor: Uint8Array,
  newIndexOf: (packageIndex: number) => number | undefined,
): RewrittenPairlessDescriptor {
  if (descriptor.length !== DESCRIPTOR_SIZE) {
    throw new Error(`記述子の長さが0x140でない: ${descriptor.length}`);
  }
  const bytes = descriptor.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sourcePackage = sourcePackageOf(view);
  const packageIndex = newIndexOf(sourcePackage);
  if (packageIndex === undefined) {
    throw new Error(`記述子のパッケージ${sourcePackage}の差し替え先が無い`);
  }
  for (let field = 0; field < FIELD_COUNT; field++) {
    const at = field * FIELD_SIZE;
    const value = view.getUint32(at, true);
    if (value === 0) continue;
    view.setUint32(at, (packageIndex << 16) | (value & 0xffff), true);
  }
  return { bytes, packageIndex };
}
