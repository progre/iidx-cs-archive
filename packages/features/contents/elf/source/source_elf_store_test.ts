import { assertEquals, assertThrows } from "@std/assert";
import { SourceElfStore } from "./source_elf_store.ts";

function fakeStore() {
  const files = new Map<string, Uint8Array>();
  const reads: string[] = [];
  const store = new SourceElfStore({
    read: (generation) => {
      reads.push(generation);
      return files.get(generation) as Uint8Array;
    },
    write: (generation, elf) => files.set(generation, elf.slice()),
  });
  return { files, reads, store };
}

Deno.test("書いた世代は、呼ぶたびにファイルから読む", () => {
  const { reads, store } = fakeStore();
  store.save("3rd", Uint8Array.of(1));
  assertEquals([...store.elfOf("3rd")], [1]);
  store.elfOf("3rd");
  assertEquals(reads, ["3rd", "3rd"]);
});

Deno.test("書いていない世代は、ファイルがあっても読まない", () => {
  const { files, store } = fakeStore();
  files.set("3rd", Uint8Array.of(1));
  assertThrows(() => store.elfOf("3rd"), Error, "3rd");
});
