// 文字の設定の定義ファイルの読み込み。ファイルを読まず、TOMLの文字列を渡して確かめる。
// 実行: deno test packages/features/contents/display/text_render/style_file_test.ts

import { parseTextStyles } from "./style_file.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

function assertThrows(toml: string, message: string): void {
  try {
    parseTextStyles(toml);
  } catch (error) {
    if (!(error as Error).message.includes(message)) {
      throw new Error(`${message} を含まない: ${(error as Error).message}`);
    }
    return;
  }
  throw new Error("エラーにならない");
}

function tableOf(name: string, lines: string[] = []): string {
  return [
    `[${name}]`,
    'font = "a.ttf"',
    "cap_height = 12",
    "outline = 1",
    "outline_softness = 0.5",
    "subtitle_scale = 0.5",
    "width_scale = 0.8",
    "letter_spacing = -0.04",
    "offset_y = 0",
    'gradient = [{ at = 0, color = "#fff" }, { at = 1, color = "#888" }]',
    ...lines,
  ].join("\n");
}

const NAMES = ["list_title", "big_title", "genre", "artist"];
const VALID = NAMES.map((name) => tableOf(name)).join("\n");

Deno.test("キーをcamelCaseの設定にし、spriteの上限を足す", () => {
  const style = parseTextStyles(VALID).bigTitle;
  assertEquals(style.font, "a.ttf", "font");
  assertEquals(style.capHeight, 12, "capHeight");
  assertEquals(style.outlineSoftness, 0.5, "outlineSoftness");
  assertEquals(style.letterSpacing, -0.04, "letterSpacing");
  assertEquals(style.gradient.at(1)?.color, "#888", "gradient");
  assertEquals(style.maxWidth, 262, "maxWidth");
  assertEquals(style.maxHeight, 43, "maxHeight");
});

Deno.test("種類の表が欠けたらエラーにする", () => {
  assertThrows(NAMES.slice(1).map((n) => tableOf(n)).join("\n"), "list_title");
});

Deno.test("知らないキーと欠けたキーをエラーにする", () => {
  const toml = VALID.replace("outline_softness = 0.5", "softness = 0.5");
  assertThrows(toml, "余分: softness 不足: outline_softness");
});

Deno.test("数のキーに文字列を書いたらエラーにする", () => {
  assertThrows(
    VALID.replace("cap_height = 12", 'cap_height = "12"'),
    "cap_height",
  );
});

Deno.test("濃淡の位置が0から1への昇順でなければエラーにする", () => {
  assertThrows(VALID.replace("at = 1,", "at = 0.9,"), "昇順");
});

Deno.test("baselineは書いた表だけに付く", () => {
  const toml = VALID.replace(
    "[list_title]",
    "[list_title]\nbaseline = 17",
  );
  const styles = parseTextStyles(toml);
  assertEquals(styles.listTitle.baseline, 17, "listTitle");
  assertEquals(styles.bigTitle.baseline, undefined, "bigTitle");
});

Deno.test("baselineに文字列を書いたらエラーにする", () => {
  assertThrows(
    VALID.replace("[list_title]", '[list_title]\nbaseline = "17"'),
    "baseline",
  );
});
