// stubが引く裏エントリーの表の組み立て。曲DBは読まず、組み立てた曲の並びで確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import type { ManifestVariant } from "@csa/core";
import type { SongContent } from "../../../model/mod.ts";
import { LIST_CODE_SLOT, listRows, listStubWords } from "./list/mod.ts";
import { bgmOverrideStubWords } from "./stub.ts";
import { CODE_SLOT, RULE, STUB_CODE, variantRows } from "./table.ts";

const contentOf = (
  songs: { targetSongIndex: number; variantOf?: ManifestVariant }[],
) => ({ songs } as unknown as SongContent);

const custom = (back: number, front: number, position: number) => ({
  targetSongIndex: back,
  variantOf: { position, rule: "custom" as const, targetSongIndex: front },
});

Deno.test("原作の組の表は、CSVで足した組を持たない", () => {
  const content = contentOf([
    custom(300, 34, 0),
    {
      targetSongIndex: 96,
      variantOf: { rule: "random8", targetSongIndex: 8 },
    },
  ]);
  assertEquals(variantRows(content), [{
    front: 8,
    param: 8,
    primary: 96,
    rule: RULE.random,
    secondary: -1,
    trigger: -1,
  }]);
});

Deno.test("CSVで足した組の表は、裏を書いた順に並べる", () => {
  assertEquals(
    listRows(
      contentOf([custom(302, 99, 2), custom(300, 99, 0), custom(301, 99, 1)]),
    ),
    [{ backs: [300, 301, 302], forced: 0, forcedBack: -1, front: 99 }],
  );
});

Deno.test("PB原盤の曲の写しの裏は、PBの枠に置いた表の曲の裏に並べる", () => {
  const content = {
    ...contentOf([custom(300, 91, 0)]),
    pbBacks: [{ position: 1, songId: 91, targetSongIndex: 301 }],
  };
  assertEquals(listRows(content), [{
    backs: [300, 301],
    forced: 0,
    forcedBack: -1,
    front: 91,
  }]);
});

Deno.test("front_chartsで出す難易度は、style*5 + rank のビットになる", () => {
  const back = custom(300, 99, 0);
  const variantOf = {
    ...back.variantOf,
    frontCharts: { dp_black: "dp_another", sp_black: "sp_another" },
  };
  assertEquals(
    listRows(contentOf([{ ...back, variantOf }])),
    [{
      backs: [300],
      forced: (1 << 4) | (1 << 9),
      forcedBack: -1,
      front: 99,
    }],
  );
});

Deno.test("表に無い難易度を鳴らす裏の印は、その裏の番号になる", () => {
  const back = custom(301, 99, 1);
  const variantOf = { ...back.variantOf, forcedBack: true as const };
  assertEquals(
    listRows(contentOf([custom(300, 99, 0), { ...back, variantOf }])),
    [{ backs: [300, 301], forced: 0, forcedBack: 1, front: 99 }],
  );
});

Deno.test("CSVで足した組の9曲目の裏はエラーになる", () => {
  assertThrows(
    () => listRows(contentOf([custom(300, 99, 8)])),
    Error,
    "曲index 99の8番目の裏が重なるか、上限を超える",
  );
});

Deno.test("CSVで足した組の裏の番号が飛んでいるとエラーになる", () => {
  assertThrows(
    () => listRows(contentOf([custom(300, 99, 0), custom(302, 99, 2)])),
    Error,
    "曲index 99の裏の番号が飛んでいる",
  );
});

Deno.test("原作の組で同じ表の曲の同じ側に裏が2つあるとエラーになる", () => {
  assertThrows(
    () =>
      variantRows(contentOf([
        {
          targetSongIndex: 300,
          variantOf: { rule: "random8", targetSongIndex: 99 },
        },
        {
          targetSongIndex: 301,
          variantOf: { rule: "random8", targetSongIndex: 99 },
        },
      ])),
    Error,
    "曲index 99の同じ側に裏エントリーが2つある",
  );
});

Deno.test("判定コードが置き場に収まる", () => {
  const original = bgmOverrideStubWords().length * 4;
  assertEquals(original <= CODE_SLOT.bytes, true, `${original}バイト`);
  const list =
    listStubWords({ recordLength: 0x134, vaddr: 0x7f00000 }, STUB_CODE)
      .length * 4;
  assertEquals(list <= LIST_CODE_SLOT.bytes, true, `${list}バイト`);
});
