import { KINDS, segmentsOf } from "./catalog_text.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const [a, e] = [actual, expected].map((value) => JSON.stringify(value));
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const EMPTY = { artist: null, fullTitle: null, genre: null, subtitle: null };

Deno.test("書いていない枠は描かない", () => {
  const row = { ...EMPTY, fullTitle: "Song", subtitle: "(Long Mix)" };
  assertEquals(
    KINDS.filter((kind) => segmentsOf(kind, row) != null),
    ["big", "small"],
  );
});

Deno.test("副題は本題と別の断片として扱う。曲リストの曲名では、副題の前に空白を入れる", () => {
  const row = { ...EMPTY, fullTitle: "Song", subtitle: "(Long Mix)" };
  assertEquals(segmentsOf("big", row), [
    { text: "Song" },
    { text: "(Long Mix)", subtitle: true },
  ]);
  assertEquals(segmentsOf("small", row), [
    { text: "Song" },
    { text: " (Long Mix)", subtitle: true },
  ]);
});

Deno.test("副題だけでは曲名の枠を描かない", () => {
  const row = { ...EMPTY, subtitle: "(Long Mix)" };
  assertEquals(segmentsOf("big", row), null);
  assertEquals(segmentsOf("small", row), null);
});

Deno.test("ジャンルとアーティストはそれぞれの列から描く", () => {
  const row = { ...EMPTY, artist: "Someone", genre: "HOUSE" };
  assertEquals(segmentsOf("genre", row), [{ text: "HOUSE" }]);
  assertEquals(segmentsOf("artist", row), [{ text: "Someone" }]);
});
