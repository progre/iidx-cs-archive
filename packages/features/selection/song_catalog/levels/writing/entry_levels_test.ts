// 曲DBエントリーに書く難易度の選択。ファイルを読まず、組み立てた行で確かめる。
// 実行: deno test packages/features/selection/song_catalog/levels/entry_levels_test.ts

import { levelsToWrite, rowsBySongId } from "./entry_levels.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const rows = new Map([
  [3, { levels: { sn: 6, sh: 9 } }],
  [4, { levels: { sn: 2 } }],
  [5, { levels: {} }],
]);

Deno.test("曲番号の行の難易度を選ぶ", () => {
  assertJson(levelsToWrite({ sourceSongIndex: 3 }, rows), {
    levels: { sn: 6, sh: 9 },
    skipMissing: false,
  });
});

Deno.test("行が無い曲と、難易度の記載が無い行の曲は、書かない", () => {
  assertJson(levelsToWrite({ sourceSongIndex: 9 }, rows), undefined);
  assertJson(levelsToWrite({ sourceSongIndex: 5 }, rows), undefined);
});

Deno.test("5鍵盤版の裏は、表の行を選び、無い譜面を飛ばす", () => {
  assertJson(
    levelsToWrite(
      { fiveKeyOf: { songId: 3 }, sourceSongIndex: 4 },
      rows,
    ),
    { levels: { sn: 6, sh: 9 }, skipMissing: true },
  );
});

Deno.test("照合結果の行を、曲DBの曲番号で引ける", () => {
  const row = { name: "a" } as Parameters<typeof rowsBySongId>[0][0]["row"];
  const table = rowsBySongId([{ row, song: { songId: 7, title: "a" } }]);
  assertJson([...table.keys()], [7]);
  assertJson(table.get(7) === row, true);
});
