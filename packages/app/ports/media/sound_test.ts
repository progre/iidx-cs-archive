// 合成したバイト列で、世代から変換経路が選ばれることを確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { convertSound, sameBytes } from "./sound.ts";

const WP_V3 = 0x00037077;
const VIG_MAGIC = 0x08640001;
const FILE_TABLE = 0x8010;
const SECTOR = 0x800;

/** 1ファイル・16バイトの暗号化済み "wp" v3 に、セクタ末尾のパディングを足す */
function wp3Bank(): { padded: Uint8Array } {
  const exact = FILE_TABLE + 0x10 + 0x10;
  const padded = new Uint8Array(exact + SECTOR);
  const dv = new DataView(padded.buffer);
  dv.setUint32(0, WP_V3, true);
  dv.setUint32(4, 0x10, true);
  dv.setUint32(0x8000, 1, true);
  dv.setUint32(0x8004, 0x10, true);
  dv.setUint32(0x8008, 1, true);
  dv.setUint32(FILE_TABLE + 4, 0x10, true);
  dv.setUint16(FILE_TABLE + 8, 1, true);
  return { padded };
}

/** `0x800` のヘッダーと `filesize` バイトの本体を持つ "vig" に、パディングを足す */
function vigBgm(filesize: number): Uint8Array {
  const buf = new Uint8Array(SECTOR + filesize + SECTOR);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, VIG_MAGIC, true);
  dv.setUint32(0x08, SECTOR, true);
  dv.setUint32(0x0c, filesize, true);
  return buf;
}

/** ビッグエンディアンヘッダーを持つ、ステレオ・48000Hz・本体 `0x1000` バイトのera1 BGM */
function era1Bgm(): Uint8Array {
  const buf = new Uint8Array(0x1800);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0x1000, false);
  dv.setUint16(4, 100, false);
  dv.setUint16(6, 48000, false);
  buf[8] = 2;
  return buf;
}

Deno.test("era3のwp v3キー音は、末尾のパディングも含めて変えない", () => {
  const { padded } = wp3Bank();
  const converted = convertSound("keysound", "djt", padded);
  assertEquals(sameBytes(converted.bytes, padded), true);
  assertEquals(converted.era, "era3");
  assertEquals(converted.soundMap, undefined);
});

Deno.test("キー音の形式が世代の期待と食い違えば止める", () => {
  const { padded } = wp3Bank();
  assertThrows(
    () => convertSound("keysound", "7th", padded),
    Error,
    "headerlessのはず",
  );
});

Deno.test("era2のBGMは、末尾のパディングも含めて変えない", () => {
  const raw = vigBgm(0x40);
  const converted = convertSound("bgm", "10th", raw);
  assertEquals(sameBytes(converted.bytes, raw), true);
  assertEquals(converted.era, "era2");
});

Deno.test("era1のBGMは、定数ヘッダーに原盤のレートを写して組み直す", () => {
  const { bytes } = convertSound("bgm", "7th", era1Bgm());
  const dv = new DataView(bytes.buffer);
  assertEquals(dv.getUint32(0, true), VIG_MAGIC);
  assertEquals(dv.getUint32(0x18, true), 48000);
  assertEquals(bytes.length, SECTOR + dv.getUint32(0x0c, true));
});

Deno.test("BGMの形式が世代の期待と食い違えば止める", () => {
  assertThrows(
    () => convertSound("bgm", "7th", vigBgm(0x40)),
    Error,
    "bigendianのはず",
  );
});

Deno.test("未登録の世代は変換しない", () => {
  assertThrows(
    () => convertSound("bgm", "unknown", vigBgm(0x40)),
    Error,
    "定義が無い世代",
  );
});

Deno.test("sameBytes は長さと内容で比べる", () => {
  assertEquals(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2])), true);
  assertEquals(sameBytes(new Uint8Array([1, 2]), new Uint8Array([1])), false);
  assertEquals(
    sameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3])),
    false,
  );
});
