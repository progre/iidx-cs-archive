// 実行: deno test packages/features/contents/overlay

import { readDescriptor, rewritePairlessDescriptor } from "./descriptor.ts";

const DESCRIPTOR_SIZE = 0x140;
const TAIL_START = 0xa0;

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

/** 39欄を`packageIndex`で埋め、末尾1欄を0にし、後半に印を書いた記述子を作る */
function descriptor(packageIndex: number): Uint8Array {
  const bytes = new Uint8Array(DESCRIPTOR_SIZE);
  const view = new DataView(bytes.buffer);
  for (let field = 0; field < 39; field++) {
    view.setUint32(field * 4, (packageIndex << 16) | field, true);
  }
  for (let offset = TAIL_START; offset < DESCRIPTOR_SIZE; offset++) {
    bytes[offset] = offset & 0xff;
  }
  return bytes;
}

function message(run: () => void): string {
  try {
    run();
  } catch (error) {
    return String(error);
  }
  return "";
}

Deno.test("非零欄の上位16bitが差し替わり、下位16bitと後半が残る", () => {
  const source = descriptor(450);
  const { bytes, packageIndex } = rewritePairlessDescriptor(
    source,
    (found) => found === 450 ? 900 : undefined,
  );
  assertEquals(packageIndex, 900, "振り直し後のindex");
  const view = new DataView(bytes.buffer);
  for (let field = 0; field < 39; field++) {
    assertEquals(
      view.getUint32(field * 4, true),
      (900 << 16) | field,
      `欄${field}`,
    );
  }
  assertEquals(view.getUint32(39 * 4, true), 0, "末尾欄");
  assertEquals(
    bytes.slice(TAIL_START).join(","),
    source.slice(TAIL_START).join(","),
    "後半",
  );
});

Deno.test("非零欄が2種類のパッケージを指すと例外", () => {
  const source = descriptor(450);
  new DataView(source.buffer).setUint32(4, (451 << 16) | 1, true);
  const text = message(() => rewritePairlessDescriptor(source, () => 900));
  if (!text.includes("2種類")) {
    throw new Error(`複数パッケージで停止しなかった: ${text}`);
  }
});

Deno.test("差し替える先のindexが無いと例外", () => {
  const source = descriptor(450);
  const text = message(() =>
    rewritePairlessDescriptor(source, () => undefined)
  );
  if (!text.includes("差し替え先が無い")) {
    throw new Error(`未解決のindexで停止しなかった: ${text}`);
  }
});

Deno.test("ELFの指定位置から記述子の長さだけを複製して読む", () => {
  const elf = new Uint8Array(DESCRIPTOR_SIZE * 2).fill(1);
  elf[DESCRIPTOR_SIZE] = 7;
  const read = readDescriptor(elf, DESCRIPTOR_SIZE);
  assertEquals(read.length, DESCRIPTOR_SIZE, "長さ");
  assertEquals(read[0], 7, "先頭");
  read[0] = 9;
  assertEquals(elf[DESCRIPTOR_SIZE], 7, "元のELFを書き換えない");
});
