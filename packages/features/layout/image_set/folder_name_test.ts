// フォルダー名の画像の写し元と記述。ファイルを読まず、組み立てたmanifestで確かめる。
// 実行: deno test packages/features/layout/image_set/folder_name_test.ts

import type { IndividualAssetManifest } from "@csa/core";
import {
  folderNameFile,
  folderNameImage,
  hasFolderNameSource,
} from "./folder_name.ts";

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

const manifestWith = (generations: string[]) =>
  ({
    sources: Object.fromEntries(
      generations.map((
        generation,
      ) => [generation, { image: generation + ".iso" }]),
    ),
  }) as unknown as IndividualAssetManifest;

Deno.test("empが収録にあれば、写し元になる", () => {
  assertJson(hasFolderNameSource(manifestWith(["emp"])), true);
});

Deno.test("empが収録に無ければ、写し元は無い", () => {
  assertJson(hasFolderNameSource(manifestWith(["djt"])), false);
});

Deno.test("曲DBに書く値は、上位16bitが写し先の画像セット、下位16bitがspriteになる", () => {
  assertJson(folderNameImage(0x123), 0x123);
});

Deno.test("画像セットの記述は、写し先のDATA1 indexと内訳を持つ", () => {
  const bytes = Uint8Array.of(9);
  assertJson(folderNameFile(bytes, ["a", "b"]), {
    bytes: { 0: 9 },
    data1Index: 0,
    summary: "folder names[0] a / b",
  });
});
