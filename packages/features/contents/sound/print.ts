// 音のファイルを本体とヘッダーに分け、それぞれのハッシュを求める。曲リストは、これで同じ音かどうかを見分ける。
// 本体は暗号を解いた平文にする。ヘッダーは、暗号の有無と形式の版の欄を0にする。
// そうすれば、世代で違うのは音量などの設定だけになる。

import type { SoundPrint, SoundPrintKind } from "@csa/core";
import { decryptFrames } from "./adpcm.ts";
import {
  detectBgmForm,
  detectKeysoundForm,
  EF_V1,
  WP_V2,
  WP_V3,
} from "./form.ts";
import { inspectWpBank, KS_TABLE_END } from "./keysound/mod.ts";

export interface SoundParts {
  body: Uint8Array;
  /** ヘッダーの無い形式は`null` */
  header: Uint8Array | null;
}

/** `01 00 64 08`のBGMの欄の位置 */
const VIG = { dataOffset: 0x08, encrypted: 0x20, filesize: 0x0c };
/** era1のBGMのヘッダーのうち、値を持つ欄(data_size・volume・sample_rate・channels)の長さ */
const ERA1_BGM_FIELDS = 9;
const BANK_MAGIC = { ef1: EF_V1, wp2: WP_V2, wp3: WP_V3 } as const;
/**
 * 16進の桁数。曲リストが比べる音・ムービー・オーバーレイのファイルは多く見ても1万本ほどで、
 * 8桁なら違うファイルどうしが偶然同じ値になる組は全体で0.01組ほどにとどまる
 */
const DIGITS = 8;

const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

function plainBody(
  bytes: Uint8Array,
  start: number,
  end: number,
  encrypted: number,
): Uint8Array {
  if (end > bytes.length) {
    throw new Error(`音の本体がファイルの外へ出る: ${end} > ${bytes.length}`);
  }
  const body = bytes.slice(start, end);
  if (encrypted === 1) {
    decryptFrames(body, 0, body.length);
  } else if (encrypted !== 0) {
    throw new Error(`is_encrypted=${encrypted} が想定外`);
  }
  return body;
}

function vigParts(bytes: Uint8Array): SoundParts {
  const view = viewOf(bytes);
  const start = view.getUint32(VIG.dataOffset, true);
  const header = bytes.slice(0, start);
  viewOf(header).setUint32(VIG.encrypted, 0, true);
  return {
    body: plainBody(
      bytes,
      start,
      start + view.getUint32(VIG.filesize, true),
      view.getUint32(VIG.encrypted, true),
    ),
    header,
  };
}

/** era1のBGMはヘッダーの長さが一定でないので、本体は末尾から`data_size`バイトを取る */
const era1BgmParts = (bytes: Uint8Array): SoundParts => ({
  body: bytes.slice(bytes.length - viewOf(bytes).getUint32(0, false)),
  header: bytes.slice(0, ERA1_BGM_FIELDS),
});

function bankParts(
  bytes: Uint8Array,
  magic: (typeof BANK_MAGIC)[keyof typeof BANK_MAGIC],
): SoundParts {
  const bank = inspectWpBank(bytes, magic, "キー音バンク");
  const header = bytes.slice(0, bank.dataOffset);
  viewOf(header).setUint32(0, 0, true);
  viewOf(header).setUint32(KS_TABLE_END + 8, 0, true);
  return {
    body: plainBody(bytes, bank.dataOffset, bank.exactSize, bank.isEncrypted),
    header,
  };
}

/** ヘッダーの無い旧バンクは本体の長さを持たないので、末尾のゼロを除いた全体を本体とする */
function withoutTrailingZeros(bytes: Uint8Array): Uint8Array {
  const end = bytes.findLastIndex((byte) => byte !== 0) + 1;
  return bytes.slice(0, end);
}

/** `bytes`は原盤から取り出したファイル全体。セクタ単位の余りを含んでよい */
export function soundParts(
  kind: SoundPrintKind,
  bytes: Uint8Array,
): SoundParts {
  if (kind === "bgm") {
    return detectBgmForm(bytes) === "vig"
      ? vigParts(bytes)
      : era1BgmParts(bytes);
  }
  const form = detectKeysoundForm(bytes);
  return form === "headerless"
    ? { body: withoutTrailingZeros(bytes), header: null }
    : bankParts(bytes, BANK_MAGIC[form]);
}

/** バイト列のハッシュ。曲リストは、音のほかにムービーとオーバーレイもこれで見分ける */
export async function printOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("").slice(0, DIGITS);
}

export async function soundPrint(
  kind: SoundPrintKind,
  bytes: Uint8Array,
): Promise<SoundPrint> {
  const { body, header } = soundParts(kind, bytes);
  return {
    body: await printOf(body),
    header: header === null ? null : await printOf(header),
    kind,
  };
}
