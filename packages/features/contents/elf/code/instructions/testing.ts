/**
 * 原盤のELFから作る書き換えを確かめるテストの補助。
 * 原盤のELFのパスは環境変数`CSA_PB_ELF`から取り、無ければテストを飛ばす。
 * 書き換えは、旧生成器の出力と一致を確かめた時点の結果のハッシュと照合する。
 */

import { createHash } from "node:crypto";
import { type InstructionPatch, MutableElf } from "../../elf/mod.ts";

const PB_ELF_VARIABLE = "CSA_PB_ELF";
const ELF_PATCH_TABLES = new URL(
  "../../../../../../data/elf_patch/",
  import.meta.url,
);

/** 権限が無い実行でも飛ばせるよう、読めなければ未設定として扱う */
function pbElfPath(): string | undefined {
  try {
    return Deno.env.get(PB_ELF_VARIABLE);
  } catch {
    return undefined;
  }
}

/** 原盤のELFを受け取るテスト。`CSA_PB_ELF`が無ければ飛ばす */
export function testWithPbElf(
  name: string,
  fn: (elf: MutableElf) => void,
): void {
  const path = pbElfPath();
  Deno.test({
    fn: () => {
      if (path === undefined) return;
      fn(new MutableElf(Deno.readFileSync(path)));
    },
    ignore: path === undefined,
    name,
  });
}

/** `data/elf_patch/`の表の文字列 */
export const readElfPatchTable = (name: string): string =>
  Deno.readTextFileSync(new URL(name + ".tsv", ELF_PATCH_TABLES));

const word = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
const line = (patch: InstructionPatch) =>
  `${word(patch.address)} ${word(patch.oldWord)} ${word(patch.newWord)}`;

/** address・旧命令語・新命令語をaddress順に並べた行のSHA-256 */
function patchDigest(rows: readonly InstructionPatch[]): string {
  const text = rows.toSorted((a, b) => a.address - b.address).map(line)
    .join("\n");
  return createHash("sha256").update(text).digest("hex");
}

export function assertPatchDigest(
  rows: readonly InstructionPatch[],
  expected: string,
  label: string,
): void {
  const actual = patchDigest(rows);
  if (actual !== expected) {
    throw new Error(`${label}: ${rows.length}件のハッシュが${actual}`);
  }
}
