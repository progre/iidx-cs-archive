// 資産を適用したCSAのELFを中間ファイルとして書く。I/Oだけを行う。
// 置き場は変えない。変えると中間ファイルのハッシュの記録と食い違う。

import { dirname } from "@std/path";
import { INTERMEDIATE_DIRECTORY } from "@csa/core";

export function writeCsaElf(elfName: string, bytes: Uint8Array): void {
  const path =
    `${INTERMEDIATE_DIRECTORY}/iso/${elfName}.assets-applied.patched`;
  Deno.mkdirSync(dirname(path), { recursive: true });
  Deno.writeFileSync(path, bytes);
}
