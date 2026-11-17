import type { Slots } from "@csa/core";

/** `{u16, u16}`の組。曲名カード・画像セット・オーバーレイの組が使う */
export type Pair = [number, number];

export function readUint(
  view: DataView,
  offset: number,
  bytes: number,
): number {
  switch (bytes) {
    case 1:
      return view.getUint8(offset);
    case 2:
      return view.getUint16(offset, true);
    case 4:
      return view.getUint32(offset, true);
  }
  throw new Error(`扱えない幅: ${bytes}`);
}

export function readInt16(view: DataView, offset: number): number {
  return view.getInt16(offset, true);
}

export function readAll(
  view: DataView,
  slots: Slots,
  bytes: number,
): number[] {
  return Array.from(
    { length: slots.count },
    (_, i) => readUint(view, slots.offset + i * bytes, bytes),
  );
}

export function readPairs(view: DataView, slots: Slots): Pair[] {
  return Array.from({ length: slots.count }, (_, i) => {
    const at = slots.offset + i * 4;
    return [readUint(view, at, 2), readUint(view, at + 2, 2)];
  });
}

/** コピーせずビューで返す */
export function readBytes(
  view: DataView,
  offset: number,
  length: number,
): Uint8Array {
  return new Uint8Array(view.buffer, view.byteOffset + offset, length);
}

export function writeUint(
  view: DataView,
  offset: number,
  bytes: number,
  value: number,
): void {
  switch (bytes) {
    case 1:
      view.setUint8(offset, value);
      return;
    case 2:
      view.setUint16(offset, value, true);
      return;
    case 4:
      view.setUint32(offset, value, true);
      return;
  }
  throw new Error(`扱えない幅: ${bytes}`);
}

export function writeInt16(
  view: DataView,
  offset: number,
  value: number,
): void {
  view.setInt16(offset, value, true);
}

export function writeAll(
  view: DataView,
  slots: Slots,
  bytes: number,
  values: number[],
): void {
  requireCount(slots, values.length);
  values.forEach((value, i) =>
    writeUint(view, slots.offset + i * bytes, bytes, value)
  );
}

export function writePairs(view: DataView, slots: Slots, pairs: Pair[]): void {
  requireCount(slots, pairs.length);
  pairs.forEach(([first, second], i) => {
    writeUint(view, slots.offset + i * 4, 2, first);
    writeUint(view, slots.offset + i * 4 + 2, 2, second);
  });
}

export function writeBytes(
  view: DataView,
  offset: number,
  bytes: Uint8Array,
): void {
  readBytes(view, offset, bytes.length).set(bytes);
}

/** 定義に無い欄(null)へは書けない */
export function required<T>(value: T | null, name: string): T {
  if (value == null) {
    throw new Error(`定義に${name}が無い`);
  }
  return value;
}

function requireCount(slots: Slots, count: number): void {
  if (count !== slots.count) {
    throw new Error(`要素数が合わない: 欄は${slots.count}、値は${count}`);
  }
}
