// HTMLの列・タブ・容量・識別子を確かめる。

import { pageHtml } from "./html.ts";
import type { SongListData, SongRow } from "../types.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const song = (key: string, extra: Partial<SongRow> = {}): SongRow => ({
  folder: "F",
  folderOrder: 1,
  generation: "g1",
  inSelectList: true,
  key,
  charts: { n: { level: 5, notes: 321 } },
  original: false,
  overlayPackages: [],
  overlaySheets: 0,
  removed: false,
  songId: 0,
  soundBytes: 1024 * 1024,
  sounds: [],
  title: key,
  videoBytes: 0,
  videos: [],
  ...extra,
});

const dataOf = (songs: SongRow[]): SongListData => ({
  contentPrints: new Map(),
  difficulties: [{ label: "N", name: "n", slot: 4 }],
  label: "test",
  movieAliases: new Map(),
  songs,
  soundPrints: new Map(),
});

const MIB = 1024 * 1024;

/** 値の無い欄 */
const NONE = `<td class="text-center text-body-tertiary">—</td>`;

/** 右に寄せる欄 */
const numberCell = (text: string) => `<td class="text-end">${text}</td>`;

/** 右端のメモの欄 */
const noteOf = (text: string) => `<td>${text}</td>`;

const htmlOf = (
  songs: SongRow[],
  difficulties: SongListData["difficulties"] = [],
) => pageHtml({ ...dataOf(songs), difficulties });

const rowHtml = (html: string, titleCell: string) => {
  const start = html.lastIndexOf("<tr", html.indexOf(titleCell));
  return html.slice(start, html.indexOf("</tr>", start));
};

Deno.test("HTMLの難易度列は並びの順に、譜面スロット番号を併記する", () => {
  const html = htmlOf([], [
    { label: "SB", name: "sp_beginner", slot: 6 },
    { label: "SN", name: "sp_normal", slot: 4 },
  ]);
  const head = html.slice(html.indexOf("<thead"), html.indexOf("</thead>"));
  const columns = [...head.matchAll(/<th>([^<]*)<\/th>/g)].map((m) => m[1]);
  assertEquals(columns.includes("6=SB"), true, "SB");
  assertEquals(columns.indexOf("6=SB") < columns.indexOf("4=SN"), true, "順");
});

Deno.test("HTMLは枠ごとのタブに、選曲リストに並ぶ曲数を出す", () => {
  const html = htmlOf([
    song("a", { folder: "1st", folderOrder: 1 }),
    song("b", { folder: "1st", folderOrder: 1, inSelectList: false }),
    song("c", { folder: "sub", folderOrder: 2 }),
  ]);
  const tabs = [...html.matchAll(/px-2" [^>]* href="#[^"]*">([^<]*)</g)]
    .map((m) => m[1]);
  assertEquals(tabs.join("|"), "曲名順 (2)|1st (1)|sub (1)", "タブ");
});

Deno.test("HTMLは開いたタブをURLの#に書き、読み込み時にそのタブを開く", () => {
  const html = htmlOf([song("a", { folder: "djt", folderOrder: 16 })]);
  assertEquals(
    html.includes(`href="#djt"`),
    true,
    "タブを開く",
  );
  assertEquals(
    html.includes("hash: decodeURIComponent(location.hash.slice(1))"),
    true,
    "読み込み時",
  );
  assertEquals(
    html.includes(`tbody tr[data-folder="djt"] { display: table-row; }`),
    true,
    "枠の行",
  );
});

Deno.test("HTMLは音とムービーの容量を出し、共有する曲数を識別子に添える", () => {
  const video = [{ id: 200, source: "pb:200" }];
  const html = htmlOf([
    song("a", { soundBytes: 2 * MIB, videoBytes: 3 * MIB, videos: video }),
    song("b", { videoBytes: 3 * MIB, videos: video }),
    song("c", { videos: [{ id: 300, original: "djt:77", source: "pb:300" }] }),
  ]);
  const adopted = rowHtml(html, ">c<");
  assertEquals(adopted.includes("djt:77<br>→ pb:300<br>→ 300"), true, "原作");
  const cells = rowHtml(html, ">a<");
  assertEquals(cells.includes(numberCell("2,097,152")), true, "音の容量");
  assertEquals(cells.includes(numberCell("3,145,728")), true, "ムービーの容量");
  assertEquals(cells.includes("pb:200<br>→ 200<br>(2曲で共有)"), true, "共有");
});

Deno.test("HTMLはオーバーレイの容量・枚数・識別子を出し、共有を添える", () => {
  const pack = { bytes: 4 * MIB, id: "pb:500" };
  const html = htmlOf([
    song("a", { overlayPackages: [pack], overlaySheets: 3 }),
    song("b", { overlayPackages: [pack], overlaySheets: 1 }),
    song("c"),
  ]);
  const cells = rowHtml(html, ">a<");
  assertEquals(cells.includes(numberCell("4,194,304")), true, "容量");
  assertEquals(cells.includes(numberCell("3")), true, "枚数");
  assertEquals(cells.includes("pb:500<br>(2曲で共有)"), true, "共有");
  const none = rowHtml(html, ">c<").endsWith(NONE.repeat(3));
  assertEquals(none, true, "オーバーレイ無し");
});

Deno.test("HTMLは難易度の欄にレベルとノーツ数を改行で分けて出す", () => {
  const html = htmlOf([song("a")], [{ label: "N", name: "n", slot: 4 }]);
  assertEquals(
    rowHtml(html, ">a<").includes(numberCell("<div>5<br>321</div>")),
    true,
    "レベルとノーツ数",
  );
});

Deno.test("HTMLは譜面が無い難易度の欄に—を出す", () => {
  const html = htmlOf(
    [song("a", { charts: {} })],
    [{ label: "N", name: "n", slot: 4 }],
  );
  assertEquals(
    rowHtml(html, ">a<").includes(NONE),
    true,
    "譜面が無い",
  );
  assertEquals(rowHtml(html, ">a<").includes("<br>321"), false, "空欄");
});

Deno.test("HTMLは全曲リストで外した譜面の欄に、レベルとノーツ数を外した印で出す", () => {
  const html = htmlOf(
    [song("a", { charts: { n: { excluded: true, level: 5, notes: 321 } } })],
    [{ label: "N", name: "n", slot: 4 }],
  );
  assertEquals(
    rowHtml(html, ">a<").includes(
      `<td class="text-end table-dark"><div>5<br>321</div></td>`,
    ),
    true,
    "外した譜面",
  );
});

Deno.test("HTMLは外した曲を note と共に黒い行で出し、数に含めない", () => {
  const html = htmlOf([
    song("a"),
    song("b", { note: "pb の B と完全一致", removed: true }),
  ]);
  const removed = rowHtml(html, ">b<");
  assertEquals(removed.startsWith(`<tr class="table-dark"`), true, "黒い行");
  assertEquals(removed.includes(noteOf("pb の B と完全一致")), true, "note");
  assertEquals(html.includes("曲 1 (原盤収録 0 + 追加 1)"), true, "曲数");
  assertEquals(html.includes("外した曲 1"), true, "外した曲数");
  assertEquals(html.includes("F (1)"), true, "タブ");
});

Deno.test("収録する曲でも、HTMLは全曲リストのメモをメモの列に出す", () => {
  const html = htmlOf([song("a", { note: "Beginner 譜面のみ異なる" })]);
  assertEquals(
    rowHtml(html, ">a<").includes(noteOf("Beginner 譜面のみ異なる")),
    true,
    "メモ",
  );
});
