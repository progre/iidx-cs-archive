/**
 * 曲値16bit化と項目配列移設で差し替える固定site。byte accessの一覧は呼び手が渡し、
 * ここには複写・初期化の呼び出しだけを置く。配列の配置は layout.ts にある。
 */

import { addiu, j, ori, reg } from "../../mips/mod.ts";
import { callTimes, MEMCPY, MEMSET } from "./calls.ts";
import {
  ALLOCATION_SITES,
  IMMEDIATE_SITES,
  newAllocationSize,
} from "./capacity_sites.ts";
import { type DeltaKind, type ItemLayout, resolveDelta } from "./layout.ts";
import type { Program } from "./program.ts";

export type CopyCall = Readonly<{ destination: DeltaKind; source: DeltaKind }>;
export type CopySite = Readonly<{
  /** `MEMCPY`を呼ぶ命令の位置。 */
  address: number;
  /** 呼び出しごとの`a0`、`a1`に足す距離。 */
  calls: readonly CopyCall[];
}>;

export type FillSite = Readonly<{
  /** `MEMSET`を呼ぶ命令の位置。 */
  address: number;
  /** 呼び出しごとの`a0`に足す距離。値と長さは元の引数をそのまま使う。 */
  calls: readonly DeltaKind[];
}>;

const ITEMS: readonly CopyCall[] = [
  { destination: "low", source: "low" },
  { destination: "high", source: "high" },
];

/** 件数ぶんの複写。record同士やrecord全体の複写はrecord長の追従で足りるので含めない。 */
const COPY_SITES: readonly CopySite[] = [
  // scene項目をstate+0x814 / +0x878へ複写する(category 0x41)
  { address: 0x18c3d4, calls: ITEMS },
  {
    address: 0x18c3e8,
    calls: [
      { destination: "low2", source: "low" },
      { destination: "high2", source: "high" },
    ],
  },
  // scene/owner項目をlist+0へ、modeをlist+0x1f1へ複写する
  { address: 0x1daec4, calls: ITEMS },
  { address: 0x1daedc, calls: [{ destination: "modes", source: "modes" }] },
  // フォルダー行の終端レコード複写: 曲indexを呼び出し元の項目配列へ、難易度をmode配列へ複写する
  {
    address: 0x20ea9c,
    calls: [
      { destination: "low", source: "none" },
      { destination: "high", source: "entries" },
    ],
  },
  { address: 0x20eabc, calls: [{ destination: "modes", source: "none" }] },
  // レコード並べ替え: merge sortの一時recordへ曲indexを複写する
  {
    address: 0x211dc4,
    calls: [
      { destination: "none", source: "none" },
      { destination: "entries", source: "entries" },
    ],
  },
];

const RECORD: readonly DeltaKind[] = ["none", "entries"];

/** 曲index配列と項目・mode・flags配列の初期化。長さの即値は layout.ts が容量に変える。 */
const FILL_SITES: readonly FillSite[] = [
  { address: 0x1d8424, calls: ["low", "high"] }, // list初期化: 項目を0で初期化
  { address: 0x1d8434, calls: ["modes"] }, // 同 mode配列
  { address: 0x1d8444, calls: ["flags"] }, // 同 flags配列
  { address: 0x20db64, calls: RECORD }, // 派生レコード再構築: 曲index
  { address: 0x20ecf0, calls: ["modes"] }, // 終端レコード複写: mode配列を0で埋める
  { address: 0x20ed00, calls: ["low", "high"] }, // 同 項目配列を0xffで埋める
  { address: 0x210f18, calls: RECORD }, // record初期化: record 0
  { address: 0x210f70, calls: RECORD }, // 以下、record群ごとの初期化
  { address: 0x211000, calls: RECORD },
  { address: 0x211098, calls: RECORD },
  { address: 0x211124, calls: RECORD },
  { address: 0x211194, calls: RECORD },
  { address: 0x211204, calls: RECORD },
  { address: 0x21126c, calls: RECORD },
  { address: 0x2112c8, calls: RECORD },
  { address: 0x211320, calls: RECORD },
  { address: 0x211378, calls: RECORD },
];

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** 複写・初期化の呼び出し、確保size、容量の即値を差し替える。 */
export function emitFixedSites(
  program: Program,
  layout: ItemLayout,
  emitStub: (words: readonly number[]) => number,
): void {
  for (const copy of COPY_SITES) {
    assert(
      program.wordAt(copy.address) === j(MEMCPY, true),
      "memcpy呼び出しではない: " + hex(copy.address),
    );
    const calls = copy.calls.map((call) => ({
      destination: resolveDelta(layout, call.destination),
      source: resolveDelta(layout, call.source),
    }));
    program.emitRow(
      copy.address,
      j(emitStub(callTimes(MEMCPY, calls)), true),
      "copy",
    );
  }
  for (const fill of FILL_SITES) {
    assert(
      program.wordAt(fill.address) === j(MEMSET, true),
      "memset呼び出しではない: " + hex(fill.address),
    );
    const calls = fill.calls.map((call) => ({
      destination: resolveDelta(layout, call),
      source: 0,
    }));
    program.emitRow(
      fill.address,
      j(emitStub(callTimes(MEMSET, calls)), true),
      "fill",
    );
  }
  for (const allocation of ALLOCATION_SITES) {
    assert(
      program.wordAt(allocation.address) ===
        addiu(reg.a0, reg.zero, allocation.oldSize),
      "確保sizeの命令ではない: " + hex(allocation.address),
    );
    // `addiu`の即値は符号付きなので、0x8000以上は零拡張の`ori a0, zero, size`で作る。
    const size = newAllocationSize(allocation, layout);
    assert(size <= 0xffff, "確保sizeが16bitに収まらない: " + allocation.name);
    program.emitRow(
      allocation.address,
      size > 0x7fff
        ? ori(reg.a0, reg.zero, size)
        : addiu(reg.a0, reg.zero, size),
      "allocation:" + allocation.name,
    );
  }
  for (const immediate of IMMEDIATE_SITES) {
    const word = program.wordAt(immediate.address);
    assert(
      (word & 0xffff) === immediate.old,
      "容量の即値ではない: " + hex(immediate.address),
    );
    const value = immediate.value(layout);
    assert(value >= 0 && value <= 0x7fff, "容量の即値が16bitに収まらない");
    program.emitRow(immediate.address, (word & 0xffff0000) | value, "capacity");
  }
}
