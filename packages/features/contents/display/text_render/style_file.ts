// 文字の設定の定義ファイル(TOML)を読み、spriteの上限と合わせた設定にする。
// 書き損じに気付けるよう、キーの過不足と型の違いはエラーにする。

import { parse } from "@std/toml";
import {
  type GradientStop,
  SPRITE_LIMITS,
  type TextKind,
  type TextLook,
  type TextStyle,
} from "./style.ts";

const KIND_OF_TABLE: Record<string, TextKind> = {
  artist: "artist",
  big_title: "bigTitle",
  genre: "genre",
  list_title: "listTitle",
};

const NUMBER_FIELDS = {
  cap_height: "capHeight",
  letter_spacing: "letterSpacing",
  offset_y: "offsetY",
  outline: "outline",
  outline_softness: "outlineSoftness",
  subtitle_scale: "subtitleScale",
  width_scale: "widthScale",
} as const;

/** 書かなくてもよいキー */
const OPTIONAL_KEYS = ["baseline"];

type Table = Record<string, unknown>;

function isTable(value: unknown): value is Table {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

/** 表のキーが`keys`と過不足なく一致することを確かめる */
function assertKeys(name: string, table: Table, keys: string[]): void {
  const extra = Object.keys(table).filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !(key in table));
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(
      `${name}のキーが違う(余分: ${extra.join(",")} 不足: ${
        missing.join(",")
      })`,
    );
  }
}

function gradientOf(name: string, value: unknown): GradientStop[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${name}は2つ以上の色の並び`);
  }
  const stops = value.map((stop, i) => {
    const label = `${name}[${i}]`;
    if (!isTable(stop)) {
      throw new Error(`${label}が表でない`);
    }
    assertKeys(label, stop, ["at", "color"]);
    if (typeof stop.at !== "number" || typeof stop.color !== "string") {
      throw new Error(`${label}のatは数、colorは文字列`);
    }
    return { at: stop.at, color: stop.color };
  });
  const ats = stops.map((stop) => stop.at);
  const ascending = ats.every((at, i) => i === 0 || ats[i - 1] <= at);
  if (ats[0] !== 0 || ats.at(-1) !== 1 || !ascending) {
    throw new Error(`${name}のatは0から1へ昇順に並べる`);
  }
  return stops;
}

function lookOf(name: string, table: unknown): TextLook {
  if (!isTable(table)) {
    throw new Error(`${name}が表でない`);
  }
  const optional = OPTIONAL_KEYS.filter((key) => key in table);
  assertKeys(name, table, [
    "font",
    ...Object.keys(NUMBER_FIELDS),
    ...optional,
    "gradient",
  ]);
  if (typeof table.font !== "string") {
    throw new Error(`${name}.fontは文字列`);
  }
  if ("baseline" in table && typeof table.baseline !== "number") {
    throw new Error(`${name}.baselineは数`);
  }
  const numbers = Object.entries(NUMBER_FIELDS).map(([key, field]) => {
    const value = table[key];
    if (typeof value !== "number") {
      throw new Error(`${name}.${key}は数`);
    }
    return [field, value];
  });
  return {
    font: table.font,
    ...Object.fromEntries(numbers),
    ...(typeof table.baseline === "number" ? { baseline: table.baseline } : {}),
    gradient: gradientOf(name + ".gradient", table.gradient),
  } as TextLook;
}

/** 定義ファイルの中身から、種類ごとの設定を作る */
export function parseTextStyles(toml: string): Record<TextKind, TextStyle> {
  const root = parse(toml);
  assertKeys("定義ファイル", root, Object.keys(KIND_OF_TABLE));
  const styles = Object.entries(KIND_OF_TABLE).map(([table, kind]) => [
    kind,
    { ...lookOf(table, root[table]), ...SPRITE_LIMITS[kind] },
  ]);
  return Object.fromEntries(styles);
}

export async function loadTextStyles(
  path: string,
): Promise<Record<TextKind, TextStyle>> {
  return parseTextStyles(await Deno.readTextFile(path));
}
