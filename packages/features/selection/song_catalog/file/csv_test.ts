// 全曲リストの読み込み。ファイルを読まず、組み立てた文字列で確かめる。
// 実行: deno test packages/features/selection/song_catalog/file/csv_test.ts

import { parse } from "@std/csv";
import { CATALOG_HEADER, parseSongCatalog } from "./csv.ts";

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

/** 索引の曲名・版・ジャンル名・曲名・副題・アーティスト名・フォルダー・共通のムービー・表の曲の3列・難易度10列を空にした残り */
const EMPTY_LEVELS = ",".repeat(21);

/** 難易度の最初の列(sb)の前に置くカンマ */
const BEFORE_LEVELS = ",".repeat(12);

const COLUMN_COUNT = CATALOG_HEADER.split(",").length;

/** 行末に空の列を補い、列名の行と同じ列の数にそろえる */
const padded = (row: string) =>
  row + ",".repeat(Math.max(0, COLUMN_COUNT - (parse(row)[0]?.length ?? 0)));

function catalogOf(...rows: string[]): string {
  return [CATALOG_HEADER, ...rows.map(padded)].join("\n") + "\n";
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
    catalogOf("A,I,E,G,F,S,R,6th"),
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

Deno.test('`"`で囲んだ値は、`,`と二重にした`"`を値の文字として読む', () => {
  const rows = parseSongCatalog(catalogOf('"A,""B"""' + EMPTY_LEVELS));
  assertJson(rows.map((row) => row.name), ['A,"B"']);
});

Deno.test("末尾の`:{song_id}`を管理名から分ける", () => {
  const rows = parseSongCatalog(
    catalogOf("A:12" + EMPTY_LEVELS, " :87" + EMPTY_LEVELS),
  );
  assertJson(rows.map((row) => [row.name, row.songId]), [["A", 12], [" ", 87]]);
});

Deno.test("書いた譜面の難易度だけを数で持つ", () => {
  const rows = parseSongCatalog(
    catalogOf("A" + BEFORE_LEVELS + ",7" + ",".repeat(8) + "12"),
  );
  assertJson(rows[0].levels, { sn: 7, dl: 12 });
});

Deno.test("列名の行が違うとエラーになる", () => {
  assertThrows(() => parseSongCatalog("title\n"), "line 1: unexpected header");
});

Deno.test("列が多すぎる行はエラーになる", () => {
  assertThrows(
    () => parseSongCatalog(catalogOf("A" + EMPTY_LEVELS + ",".repeat(3))),
    "line 2: 25 columns",
  );
});

Deno.test("列の足りない行はエラーになる", () => {
  assertThrows(
    () => parseSongCatalog([CATALOG_HEADER, "A,,,,Song,(Mix)"].join("\n")),
    "line 2: 6 columns",
  );
});

Deno.test("数でない難易度はエラーになる", () => {
  assertThrows(
    () =>
      parseSongCatalog(catalogOf("A" + BEFORE_LEVELS + "y" + ",".repeat(9))),
    "line 2: sb is not a number or x",
  );
});

Deno.test("難易度の列のxは、収録しない譜面として読み、レベルには含めない", () => {
  const [row] = parseSongCatalog(
    catalogOf("A" + BEFORE_LEVELS + "x,5,,x"),
  );
  assertJson(row.excludedCharts, ["sb", "sa"]);
  assertJson(row.levels, { sn: 5 });
});

Deno.test("excludeに何か書いた行は外す印を持ち、noteはそのまま読む", () => {
  const rows = parseSongCatalog(
    catalogOf(
      "A" + EMPTY_LEVELS + ",x,音ずれ",
      "B" + EMPTY_LEVELS + ",,メモ",
    ),
  );
  assertJson(rows.map((row) => [row.exclude, row.note]), [
    [true, "音ずれ"],
    [false, "メモ"],
  ]);
});

Deno.test("excludeとnoteが空の行は、外さずメモも無い", () => {
  const [row] = parseSongCatalog(catalogOf("A"));
  assertJson([row.exclude, row.note], [false, null]);
});

/** common_movieの後ろのsave_slot_ownerの列に書いた行 */
const withSlotOwner = (owner: string) => "B" + ",".repeat(9) + owner;

Deno.test("common_movieに書いた組のキーを読む", () => {
  const [row] = parseSongCatalog(catalogOf("B" + ",".repeat(8) + "V_5th"));
  assertJson(row.commonMovie, "V_5th");
});

Deno.test("save_slot_ownerに*を書いた行は、枠の持ち主の印を持つ", () => {
  const [row] = parseSongCatalog(catalogOf(withSlotOwner("*")));
  assertJson(row.front, { slotOwner: true });
});
