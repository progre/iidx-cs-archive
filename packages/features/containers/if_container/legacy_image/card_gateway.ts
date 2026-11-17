// 曲名カードの`.if`のファイルを書く。

import { dirname } from "@std/path";

export function writeTitleCard(path: string, bytes: Uint8Array): void {
  Deno.mkdirSync(dirname(path), { recursive: true });
  Deno.writeFileSync(path, bytes);
}
