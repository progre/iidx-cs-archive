// 曲へ書く作品番号の決め方。
// 作品番号を求める関数の組は、小さなダミーで置き換えて確かめる。
// 実行: deno test packages/features/selection/manifest/build/folder/rules_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import { type CarriedSong, folderCarry } from "./carry.ts";
import {
  folderOverrideKey,
  newFolderRules,
  type VersionTables,
} from "./rules.ts";

const FOLDERS: Record<string, number> = { "1st": 0, "2nd": 2, "RED": 11 };
const GENERATION_NUMBER: Record<string, number> = {
  "3rd": 3,
  "4th": 4,
  "5th": 5,
  "6th": 6,
  "7th": 7,
  "us": 11,
};
const OLD = 0;
const CS = 2;

const tables: VersionTables = {
  folderVersion: (name) => FOLDERS[name] ?? Number(name),
  markedVersion: (generation, mark) => {
    if (mark === OLD) {
      return undefined;
    }
    return mark === CS && generation === "3rd"
      ? FOLDERS["1st"]
      : GENERATION_NUMBER[generation];
  },
  pbVersion: (version) => version,
  sourceVersionToCsa: (_generation, version) => version === 1 ? 0 : version,
  unmarkedVersion: (generation, mark) =>
    GENERATION_NUMBER[generation] - (mark === OLD ? 1 : 0),
};

/** 引き継ぎ索引は規則1と規則2を当てはめた値でできているので、試験もその形で与える */
const carryOf = (rows: CarriedSong[]) =>
(
  versionOf: (row: CarriedSong) => number | undefined,
) => folderCarry(rows, versionOf);

const row = (
  generation: string,
  canonicalKey: string,
  rest: Partial<CarriedSong> = {},
): CarriedSong => ({
  canonicalKey,
  sourceGeneration: generation,
  sourceSongIndex: 0,
  ...rest,
});

Deno.test("作品番号は全曲リストのfolder列・引き継ぎ・既定の順で決まる", () => {
  const rules = newFolderRules(
    new Map([
      [folderOverrideKey("5th", 1), 3],
      [folderOverrideKey("6th", 0), 8],
    ]),
    tables,
    carryOf([
      row("10th", "B", { sourceVersion: 10 }),
      row("hs", "C", { sourceVersion: 2 }),
    ]),
    () => new Set(["E"]),
  );
  assertEquals(rules.versionOf(row("5th", "A", { sourceSongIndex: 1 })), 3);
  assertEquals(rules.versionOf(row("5th", "A")), 5);
  assertEquals(rules.versionOf(row("6th", "B")), 8);
  assertEquals(rules.versionOf(row("7th", "B")), 10);
  assertEquals(rules.versionOf(row("9th", "B", { sourceVersion: 1 })), 10);
  assertEquals(rules.versionOf(row("9th", "D", { sourceVersion: 1 })), 0);
  assertEquals(rules.versionOf(row("9th", "D", { sourceVersion: 3 })), 3);
  assertEquals(rules.versionOf(row("3rd", "C")), 2);
  assertEquals(rules.versionOf(row("4th", "D")), 4);
  assertEquals(rules.versionOf(row("5th", "D", { newOld: 0 })), 4);
  assertEquals(rules.versionOf(row("3rd", "D", { newOld: 2 })), 0);
  assertEquals(rules.versionOf(row("7th", "E", { newOld: 0 })), 2);
  assertEquals(rules.versionOf(row("us", "D")), 11);
});

Deno.test("全曲リストの行番号を持つ曲は、その行のfolder列を使う", () => {
  const rules = newFolderRules(
    new Map([
      [folderOverrideKey("5th", 0), 3],
      [folderOverrideKey("5th", 0, 4), 8],
    ]),
    tables,
    carryOf([]),
    () => new Set(),
  );
  assertEquals(rules.versionOf(row("5th", "A")), 3);
  assertEquals(rules.versionOf(row("5th", "A", { catalogLine: 4 })), 8);
  assertEquals(rules.versionOf(row("5th", "A", { catalogLine: 5 })), 5);
});

Deno.test("引き継ぎ元が食い違う曲にfolder列が無いときは、例外で止まる", () => {
  const carry = carryOf([
    row("pb", "X", { sourceVersion: 1, sourceSongIndex: 89 }),
    row("10th", "X", { sourceVersion: 10 }),
  ]);
  assertThrows(
    () =>
      newFolderRules(new Map(), tables, carry, () => new Set()).versionOf(
        row("6th", "X"),
      ),
    Error,
    "1(pb) / 10(10th)",
  );
  assertEquals(
    newFolderRules(
      new Map([[folderOverrideKey("6th", 0), 8]]),
      tables,
      carry,
      () => new Set(),
    )
      .versionOf(row("6th", "X")),
    8,
  );
});

Deno.test("folder列で指定しない曲には、指定前の作品番号が無い", () => {
  const rules = newFolderRules(new Map(), tables, carryOf([]), () => new Set());
  assertEquals(
    rules.overriddenFrom(row("8th", "A", { sourceVersion: 8 })),
    undefined,
  );
});

Deno.test("folder列で指定した曲は、指定が無ければ規則が決める作品番号を返す", () => {
  const rules = newFolderRules(
    new Map([[folderOverrideKey("8th", 0), 10]]),
    tables,
    carryOf([]),
    () => new Set(),
  );
  const song = row("8th", "A", { sourceVersion: 8 });
  assertEquals(rules.versionOf(song), 10);
  assertEquals(rules.overriddenFrom(song), 8);
});

Deno.test("指定前の作品番号を引き継ぎで決めるとき、その曲自身の指定は引き継ぎ元に数えない", () => {
  const self = row("4th", "A");
  const rules = newFolderRules(
    new Map([[folderOverrideKey("4th", 0), 9]]),
    tables,
    carryOf([self, row("9th", "A", { sourceSongIndex: 1, sourceVersion: 9 })]),
    () => new Set(),
  );
  assertEquals(rules.overriddenFrom(self), 9);
  const alone = newFolderRules(
    new Map([[folderOverrideKey("4th", 0), 9]]),
    tables,
    carryOf([self]),
    () => new Set(),
  );
  assertEquals(alone.overriddenFrom(self), GENERATION_NUMBER["4th"]);
});

Deno.test("引き継ぎ元が食い違うので指定した曲は、指定前の作品番号が決まらない", () => {
  const self = row("4th", "A");
  const rules = newFolderRules(
    new Map([[folderOverrideKey("4th", 0), 9]]),
    tables,
    carryOf([
      self,
      row("8th", "A", { sourceSongIndex: 1, sourceVersion: 8 }),
      row("9th", "A", { sourceSongIndex: 2, sourceVersion: 9 }),
    ]),
    () => new Set(),
  );
  assertEquals(rules.overriddenFrom(self), null);
});
