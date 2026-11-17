import { assertEquals, assertNotEquals } from "@std/assert";
import { WP_V2, WP_V3 } from "./form.ts";
import { FILE_TABLE, KS_TABLE_END } from "./keysound/mod.ts";
import { soundParts } from "./print.ts";

/** 先頭フレームが無音で、2フレーム目に音がある本体 */
const BODY = Uint8Array.from({ length: 48 }, (_, i) => i < 16 ? 0 : i);

/** `byte0`はXOR、`byte1`〜`byte3`は減算で暗号化する */
function encrypted(body: Uint8Array, key: readonly number[]): Uint8Array {
  const out = body.slice();
  for (let p = 0; p < out.length; p += 16) {
    out[p] ^= key[0];
    key.slice(1).forEach((k, i) => {
      out[p + 1 + i] = (out[p + 1 + i] + k) & 0xff;
    });
  }
  return out;
}

function vig(body: Uint8Array, isEncrypted: number, volume: number) {
  const bytes = new Uint8Array(0x800 + body.length + 0x30);
  const view = new DataView(bytes.buffer);
  view.setUint32(0x00, 0x08640001, true);
  view.setUint32(0x08, 0x800, true);
  view.setUint32(0x0c, body.length, true);
  view.setUint32(0x20, isEncrypted, true);
  view.setUint32(0x28, volume, true);
  bytes.set(body, 0x800);
  return bytes;
}

function bank(body: Uint8Array, magic: number, isEncrypted: number) {
  const bytes = new Uint8Array(FILE_TABLE + 0x10 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, magic, true);
  view.setUint32(4, 0x10, true);
  view.setUint32(KS_TABLE_END, 1, true);
  view.setUint32(KS_TABLE_END + 4, body.length, true);
  view.setUint32(KS_TABLE_END + 8, isEncrypted, true);
  view.setUint32(FILE_TABLE + 4, body.length, true);
  view.setUint16(FILE_TABLE + 8, 1, true);
  bytes.set(body, FILE_TABLE + 0x10);
  return bytes;
}

Deno.test("BGMの暗号を外しても、本体とヘッダーは変わらない。音量を変えると、ヘッダーだけが変わる", () => {
  const plain = soundParts("bgm", vig(BODY, 0, 0x38));
  assertEquals(plain.body, BODY);
  assertEquals(
    soundParts("bgm", vig(encrypted(BODY, [0xff, 0, 2, 0]), 1, 0x38)),
    plain,
  );
  const louder = soundParts("bgm", vig(BODY, 0, 0x4b));
  assertEquals(louder.body, plain.body);
  assertNotEquals(louder.header, plain.header);
});

Deno.test("キー音は、形式の版と暗号の鍵が違っても同じ本体とヘッダーになる", () => {
  const plain = soundParts("keysound", bank(BODY, WP_V2, 0));
  assertEquals(plain.body, BODY);
  assertEquals(
    soundParts(
      "keysound",
      bank(encrypted(BODY, [0xff, 0x00, 0x24, 0x00]), WP_V3, 1),
    ),
    plain,
  );
  assertEquals(
    soundParts(
      "keysound",
      bank(encrypted(BODY, [0xff, 0x02, 0x11, 0xc9]), WP_V2, 1),
    ),
    plain,
  );
});
