// 実行: deno test packages/features/contents/overlay
// 枠0の据え置き、枠1以降の詰め直し、空枠、枠数の超過を見る。

import { encodePbOverlay } from "./pb.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

/** u16の並びを16進で並べ、枠ごとの値を目で追えるようにする */
function words(bytes: Uint8Array): string {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from(
    { length: bytes.length / 2 },
    (_, i) => dv.getUint16(i * 2, true).toString(16),
  ).join(" ");
}

/** パッケージはDATA1 indexそのものにし、写像を恒等にする */
const encode = (
  packages: readonly number[],
  pairs: readonly ({ animation: number; packageIndex: number } | null)[],
) => encodePbOverlay({ packages, pairs }, (index) => index);

Deno.test("枠0は据え置き、枠1以降の有効な組を順に詰める", () => {
  const fields = encode(
    [700, 701],
    [{ animation: 3, packageIndex: 0 }, null, {
      animation: 4,
      packageIndex: 1,
    }],
  );
  assertEquals(
    words(fields.packages),
    "2bc 2bd ffff ffff ffff ffff ffff ffff",
    "一覧",
  );
  assertEquals(
    words(fields.pairs),
    "3 2bc 4 2bd ffff ffff ffff ffff ffff ffff ffff ffff ffff ffff ffff ffff",
    "組",
  );
});

Deno.test("枠0が空でも枠1以降は枠1から詰まる", () => {
  const fields = encode([700], [null, null, { animation: 5, packageIndex: 0 }]);
  assertEquals(
    words(fields.pairs).startsWith("ffff ffff 5 2bc ffff ffff"),
    true,
    "空の枠0の後ろへ詰める",
  );
});

Deno.test("オーバーレイを持たない曲は全枠が空になる", () => {
  const fields = encode([], []);
  assertEquals(
    words(fields.packages),
    "ffff ffff ffff ffff ffff ffff ffff ffff",
    "一覧",
  );
  assertEquals(
    new Set(fields.pairs).size,
    1,
    "組は0xFFで埋まる",
  );
});

function message(run: () => void): string {
  try {
    run();
  } catch (error) {
    return String(error);
  }
  return "";
}

Deno.test("枠に収まらないパッケージと組は停止する", () => {
  const nine = Array.from({ length: 9 }, (_, i) => 700 + i);
  if (
    !message(() => encode(nine, [])).includes("パッケージが9本")
  ) {
    throw new Error("パッケージ超過で停止しなかった");
  }
  const pairs = Array.from({ length: 9 }, () => ({
    animation: 0,
    packageIndex: 0,
  }));
  if (!message(() => encode([700], pairs)).includes("組が9本")) {
    throw new Error("組の超過で停止しなかった");
  }
});

Deno.test("一覧に無いパッケージを指す組は停止する", () => {
  const text = message(() =>
    encode([700], [null, { animation: 1, packageIndex: 2 }])
  );
  if (!text.includes("一覧に無い")) {
    throw new Error(`一覧の外を指す組で停止しなかった: ${text}`);
  }
});
