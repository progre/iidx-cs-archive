/**
 * 5KEYSの切り替えと記録に関わる語を、stubへの`jal`に置き換える。
 * stubと対の表は、高位PT_LOADの追加コード領域へ書く。
 */

import { type MutableElf, overwriteCode } from "../../../elf/mod.ts";
import { jal, NOP } from "../../mips/mod.ts";
import type { SongContent } from "../../../model/mod.ts";
import { wordsOf, writeSlot } from "../area.ts";
import { fiveKeysStubs, type StubName } from "./stubs.ts";
import {
  CODE_SLOT,
  STATE_SLOT,
  TABLE_SLOT,
  TWIN_TABLE,
  twinRows,
  twinTableBytes,
} from "./table.ts";

interface FiveKeysSite {
  address: number;
  stub: StubName;
  /** 潰す語数。既定は`jal`1語ぶん */
  words?: number;
}

/** 置き換える位置。役割は世代ごとの関数名でなく、差し込むstubの名前で示す */
const SITES: readonly FiveKeysSite[] = [
  // 記録種別と記録可否。5KEYSをアシスト扱いにする判定
  { address: 0x1708ec, stub: "record" },
  { address: 0x171938, stub: "record" },
  { address: 0x1719a8, stub: "record" },
  { address: 0x1719c8, stub: "record" },
  { address: 0x1744f8, stub: "record" },
  { address: 0x174558, stub: "record" },
  { address: 0x1745a8, stub: "record" },
  // ランプ種別・スコアの書き込み・リザルトの表示。演奏側へ写した5KEYSを見る判定
  { address: 0x19c4d0, stub: "play" },
  { address: 0x19c4e0, stub: "play" },
  { address: 0x19c4f8, stub: "play" },
  { address: 0x19c57c, stub: "play" },
  { address: 0x19c58c, stub: "play" },
  { address: 0x19c5a4, stub: "play" },
  { address: 0x19ccf0, stub: "play" },
  { address: 0x19cd00, stub: "play" },
  { address: 0x19cd28, stub: "play" },
  { address: 0x1e1618, stub: "play" },
  { address: 0x1e37dc, stub: "play" },
  { address: 0x1e3930, stub: "play" },
  { address: 0x1e393c, stub: "play" },
  { address: 0x1e3a0c, stub: "play" },
  { address: 0x1e3ab0, stub: "play" },
  { address: 0x1e3af8, stub: "play" },
  { address: 0x1e3ca4, stub: "play" },
  { address: 0x1e3d70, stub: "play" },
  { address: 0x1e3e34, stub: "play" },
  { address: 0x1e6828, stub: "play" },
  { address: 0x1e68b0, stub: "play" },
  { address: 0x1e68bc, stub: "play" },
  { address: 0x1e69d0, stub: "play" },
  { address: 0x1e69dc, stub: "play" },
  { address: 0x1e6b4c, stub: "play" },
  { address: 0x1e6b58, stub: "play" },
  { address: 0x1e7498, stub: "play" },
  // リザルトのベストとの比較表示。5KEYSの欄を直接見る判定
  { address: 0x17ddfc, stub: "field" },
  { address: 0x17de14, stub: "field" },
  { address: 0x180278, stub: "field" },
  { address: 0x18028c, stub: "field" },
  { address: 0x180400, stub: "field" },
  { address: 0x180518, stub: "field" },
  { address: 0x1883ec, stub: "rebuild" },
  { address: 0x188750, stub: "cursor", words: 2 },
  { address: 0x1df8b0, stub: "register" },
];

/** 5鍵盤版を持たない構成では何もしない */
export function writeFiveKeys(elf: MutableElf, content: SongContent): void {
  if (twinRows(content).length === 0) return;
  const stubs = fiveKeysStubs();
  // stubは置き場の先頭から隙間無く詰めてある。
  // そのため、まとめて書ける。
  writeSlot(elf, CODE_SLOT, stubs.flatMap((stub) => stub.words));
  // 状態語の初期値は0である。
  // 0を書くのは、置き場が空であることを確かめるためである。
  writeSlot(elf, STATE_SLOT, [0]);
  writeSlot(elf, TABLE_SLOT, wordsOf(twinTableBytes(content)));
  const vaddrOf = new Map(stubs.map((stub) => [stub.name, stub.vaddr]));
  for (const site of SITES) {
    const target = vaddrOf.get(site.stub);
    if (target === undefined) throw new Error(`stubが無い: ${site.stub}`);
    overwriteCode(elf, site.address, [jal(target)], site.words);
  }
}

export function verifyFiveKeys(elf: MutableElf, content: SongContent): void {
  if (twinRows(content).length === 0) return;
  const stubs = fiveKeysStubs();
  const vaddrOf = new Map(stubs.map((stub) => [stub.name, stub.vaddr]));
  for (const site of SITES) {
    if (elf.u32(site.address) !== jal(vaddrOf.get(site.stub) as number)) {
      throw new Error(`0x${site.address.toString(16)}の呼び出しが書けていない`);
    }
    for (let index = 1; index < (site.words ?? 1); index++) {
      if (elf.u32(site.address + index * 4) !== NOP) {
        throw new Error(`0x${site.address.toString(16)}に元の命令が残っている`);
      }
    }
  }
  for (const stub of stubs) {
    stub.words.forEach((word, index) => {
      if (elf.u32(stub.vaddr + index * 4) !== word) {
        throw new Error(`${stub.name} stubの${index}語目が書けていない`);
      }
    });
  }
  wordsOf(twinTableBytes(content)).forEach((word, index) => {
    if (elf.u32(TWIN_TABLE + index * 4) !== word) {
      throw new Error(`5鍵盤版の対の表の${index}語目が書けていない`);
    }
  });
}
