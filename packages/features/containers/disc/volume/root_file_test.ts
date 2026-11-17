import { readRootFile } from "./segment.ts";

function fakeSource(bytes: Uint8Array) {
  return {
    collectPaths: () =>
      Promise.resolve(
        new Map([
          ["BOOT.ELF", { lba: 1, size: 3 }],
          ["DIR/BOOT.ELF", { lba: 0, size: 1 }],
        ]),
      ),
    readAt: (offset: number, length: number) =>
      Promise.resolve(bytes.slice(offset, offset + length)),
  };
}

Deno.test("ルート直下のファイルを LBA とサイズで読む", async () => {
  const bytes = new Uint8Array(2048 + 3).map((_, i) => i % 251);
  const got = await readRootFile(fakeSource(bytes), "boot.elf");
  if (got.length !== 3 || got[0] !== bytes[2048]) {
    throw new Error("取り出した内容が違う");
  }
});

Deno.test("ルートに無い名前は例外にする", async () => {
  let failed = false;
  await readRootFile(fakeSource(new Uint8Array(1)), "NONE").catch(() => {
    failed = true;
  });
  if (!failed) {
    throw new Error("例外にならなかった");
  }
});
