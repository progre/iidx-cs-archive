// 実行: deno test packages/features/contents/display/layout/layouts_test.ts
// 並べ替えが要る世代の判定を確かめる。

import { assertEquals } from "@std/assert";
import { repackDescriptorStart } from "./layouts.ts";

Deno.test("並べ替えが要るのは、記述子が+4の世代だけ", () => {
  assertEquals(repackDescriptorStart("10th"), 4);
  assertEquals(repackDescriptorStart("hs"), 8);
  assertEquals(repackDescriptorStart("pb"), null);
  assertEquals(repackDescriptorStart("3rd"), null);
});
