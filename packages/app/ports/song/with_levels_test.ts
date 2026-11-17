// 全曲リストの難易度の曲DBエントリーへの反映。ファイルを読まず、組み立てた行とエントリーで確かめる。
// 実行: deno test packages/app/ports/song/with_levels_test.ts

import { PB_ENTRY, withBeginnerLimit, withLevels } from "./song_db.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
}

/** 指定した譜面にノーツ数を入れ、レベル欄は原作の値(1)で埋めたエントリー */
function entryWith(...names: string[]): string {
  const entry = new Uint8Array(PB_ENTRY.size);
  const view = new DataView(entry.buffer);
  for (const name of names) {
    view.setUint16(PB_ENTRY.notesFieldOffsets(name)[0], 100, true);
    entry[PB_ENTRY.levelFieldOffset(name)] = 1;
  }
  return PB_ENTRY.encode(entry);
}

const levelOf = (text: string, name: string) =>
  PB_ENTRY.decode(text)[PB_ENTRY.levelFieldOffset(name)];

const rows = new Map([
  [3, { levels: { sn: 6, sh: 9 } }],
  [4, { levels: { sn: 2 } }],
]);

Deno.test("曲番号の行の難易度を書き、書いていない譜面は原作のままにする", () => {
  const text = withLevels(
    entryWith("sp_normal", "sp_hyper", "sp_another"),
    { sourceGeneration: "pb", sourceSongIndex: 3 },
    rows,
  );
  assertEquals(levelOf(text, "sp_normal"), 6);
  assertEquals(levelOf(text, "sp_hyper"), 9);
  assertEquals(levelOf(text, "sp_another"), 1);
});

Deno.test("行が無い曲は、エントリーを変えない", () => {
  const before = entryWith("sp_normal");
  assertEquals(
    withLevels(before, { sourceGeneration: "pb", sourceSongIndex: 9 }, rows),
    before,
  );
});

Deno.test("5鍵盤版の裏は、表の行の難易度を、裏が持つ譜面にだけ写す", () => {
  const text = withLevels(
    entryWith("sp_normal"),
    { fiveKeyOf: { songId: 3 }, sourceGeneration: "dd", sourceSongIndex: 4 },
    rows,
  );
  assertEquals(levelOf(text, "sp_normal"), 6);
  assertEquals(levelOf(text, "sp_hyper"), 0);
});

Deno.test("曲に無い譜面へ書くと、世代と曲番号を付けて止まる", () => {
  try {
    withLevels(entryWith("sp_normal"), {
      sourceGeneration: "pb",
      sourceSongIndex: 3,
    }, rows);
  } catch (error) {
    assertEquals((error as Error).message, "pb song3");
    return;
  }
  throw new Error("例外が出なかった");
});

Deno.test("全曲リストに書いた SP BEGINNER のレベルも、3を超えれば3にする", () => {
  const text = withBeginnerLimit(
    withLevels(
      entryWith("sp_beginner"),
      { sourceGeneration: "pb", sourceSongIndex: 5 },
      new Map([[5, { levels: { sb: 7 } }]]),
    ),
  );
  assertEquals(levelOf(text, "sp_beginner"), 3);
});
