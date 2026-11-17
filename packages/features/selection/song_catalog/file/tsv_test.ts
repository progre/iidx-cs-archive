// 全曲リストの読み込み。ファイルを読まず、組み立てた文字列で確かめる。
// 実行: deno test packages/features/selection/song_catalog/file/tsv_test.ts

import { CATALOG_HEADER, parseSongCatalog } from "./tsv.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

function assertThrows(run: () => unknown, message: string): void {
  try {
    run();
  } catch (error) {
    if (!(error as Error).message.includes(message)) {
      throw new Error(`例外の文が違う: ${(error as Error).message}`);
    }
    return;
  }
  throw new Error("例外が出なかった");
}

/** 索引の曲名・版・ジャンル名・曲名・副題・アーティスト名・表の曲の3列・フォルダー・難易度10列を空にした残り */
const EMPTY_LEVELS = "\t".repeat(20);

function catalogOf(...rows: string[]): string {
  return [CATALOG_HEADER, ...rows].join("\n") + "\n";
}

Deno.test("管理名と行番号を読み、空の値は持たない", () => {
  const rows = parseSongCatalog(catalogOf("A" + EMPTY_LEVELS));
  assertJson(rows, [{
    line: 2,
    name: "A",
    songId: null,
    indexTitle: null,
    edition: null,
    genre: null,
    fullTitle: null,
    subtitle: null,
    artist: null,
    folder: null,
    levels: {},
    excludedCharts: [],
    exclude: false,
    note: null,
  }]);
});

Deno.test("索引の曲名・版・ジャンル名・曲名・副題・アーティスト名・フォルダーを読む", () => {
  const rows = parseSongCatalog(
    catalogOf("A\tI\tE\tG\tF\tS\tR\t\t\t\t6th" + "\t".repeat(10)),
  );
  assertJson(
    rows.map((row) => [
      row.indexTitle,
      row.edition,
      row.genre,
      row.fullTitle,
      row.subtitle,
      row.artist,
      row.folder,
    ]),
    [["I", "E", "G", "F", "S", "R", "6th"]],
  );
});

Deno.test('`"`と`,`は普通の文字として読む', () => {
  const rows = parseSongCatalog(catalogOf('"A,B"' + EMPTY_LEVELS));
  assertJson(rows.map((row) => row.name), ['"A,B"']);
});

Deno.test("末尾の`:{song_id}`を管理名から分ける", () => {
  const rows = parseSongCatalog(
    catalogOf("A:12" + EMPTY_LEVELS, " :87" + EMPTY_LEVELS),
  );
  assertJson(rows.map((row) => [row.name, row.songId]), [["A", 12], [" ", 87]]);
});

Deno.test("書いた譜面の難易度だけを数で持つ", () => {
  const rows = parseSongCatalog(
    catalogOf("A" + "\t".repeat(12) + "7" + "\t".repeat(8) + "12"),
  );
  assertJson(rows[0].levels, { sn: 7, dl: 12 });
});

Deno.test("列名の行が違うとエラーになる", () => {
  assertThrows(() => parseSongCatalog("title\n"), "line 1: unexpected header");
});

Deno.test("列が多すぎる行はエラーになる", () => {
  assertThrows(
    () => parseSongCatalog(catalogOf("A" + EMPTY_LEVELS + "\t".repeat(3))),
    "line 2: 24 columns",
  );
});

Deno.test("行末で省いた列は空として読む", () => {
  const rows = parseSongCatalog(catalogOf("A\t\t\t\tSong\t(Mix)"));
  assertJson(
    rows.map((row) => [row.genre, row.fullTitle, row.subtitle, row.artist]),
    [[null, "Song", "(Mix)", null]],
  );
  assertJson(rows[0].levels, {});
});

Deno.test("数でない難易度はエラーになる", () => {
  assertThrows(
    () =>
      parseSongCatalog(catalogOf("A" + "\t".repeat(11) + "y" + "\t".repeat(9))),
    "line 2: sb is not a number or x",
  );
});

Deno.test("難易度の列のxは、収録しない譜面として読み、レベルには含めない", () => {
  const [row] = parseSongCatalog(
    catalogOf("A" + "\t".repeat(11) + "x\t5\t\tx"),
  );
  assertJson(row.excludedCharts, ["sb", "sa"]);
  assertJson(row.levels, { sn: 5 });
});

Deno.test("excludeに何か書いた行は外す印を持ち、noteはそのまま読む", () => {
  const rows = parseSongCatalog(
    catalogOf(
      "A" + EMPTY_LEVELS + "\tx\t音ずれ",
      "B" + EMPTY_LEVELS + "\t\tメモ",
    ),
  );
  assertJson(rows.map((row) => [row.exclude, row.note]), [
    [true, "音ずれ"],
    [false, "メモ"],
  ]);
});

Deno.test("excludeとnoteを省いた行は、外さずメモも無い", () => {
  const [row] = parseSongCatalog(catalogOf("A"));
  assertJson([row.exclude, row.note], [false, null]);
});

/** アーティスト名の後ろに、front・front_charts・front_rule の列を書いた行 */
const withFront = (front: string) => "B" + "\t".repeat(7) + front;

Deno.test("frontに*を書いた行は、組の表にする印を持つ", () => {
  const [row] = parseSongCatalog(catalogOf(withFront("*")));
  assertJson(row.front, { preferred: true });
});
