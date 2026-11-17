import {
  type IopModuleFile,
  type IopModulePatch,
  iopPatchRange,
  type SourcePatch,
  sourcePatchOf,
} from "./source_patch.ts";
import { addu, beq, blez, lw, or, reg, sll, subu } from "../mips/mod.ts";

/** 他の feature の関数。実装は app が渡す */
export interface IopSourceReader {
  /** 原盤のイメージの`offset`から`length`バイトを読む */
  readAt(offset: number, length: number): Promise<Uint8Array>;
}

/** `MODULES/IOPRP310.IMG`内のIOPモジュールへ当てる、セクタID照合の差し替え。 */
// `MODULES/IOPRP310.IMG`に入る`cdvdfsv`のセクタID照合を、下位24bitの比較へ組み替える。
// cdvdfsvはEEからの読み込み要求を自前のIOPバッファーへ生セクタで読み、ヘッダーの3バイトの
// セクタ番号から`0x30000`を引いた値を要求LSNと32bitで比べる(`cdvdfsv_checksid`)。
// cdvdmanと同じ折り返しで一致せず、16セクタ手前からの読み直しを繰り返す。
/**
 * 差し替える6語。IOPアドレスでは`0x3ef8c`〜`0x3efa0`。
 * s0はヘッダーから取り出したセクタ番号、s4は要求LSN、t0はipi_emuである。
 * 原盤は、s0とs4が等しく、かつt0が0のときに、次のセクタへ進む
 */
export const CDVDFSV_SECTOR_ID: IopModulePatch = {
  name: "cdvdfsv sector ID 24bit",
  imgOffset: 0x3401c,
  wordCount: 6,
  sha256: "f5e6fbd54c8d4c958caa68215fb009514d8b50d589f8df5b153c397952a18f25",
  // t0の読み出しを先頭へ寄せ、(差 << 8) | ipi_emu が0なら次のセクタへ進む。
  // 最後の語はbeqの遅延スロットに残り、どちらの経路でも元と同じく実行される
  replace: (original) => [
    lw(reg.t0, 0x24, reg.sp),
    subu(reg.v0, reg.s0, reg.s4),
    sll(reg.v0, reg.v0, 8),
    or(reg.v0, reg.v0, reg.t0),
    beq(reg.v0, reg.zero, 17),
    original[5],
  ],
};

// `MODULES/IOPRP310.IMG`に入る`cdvdman 3100P`のセクタID照合を、下位24bitの比較へ組み替える。
// cdvdmanはDVD生セクタのヘッダーから3バイトのセクタ番号を取り、`0x30000`を引いた値を要求LSNと
// 32bitで比べる。番号は3バイトなのでLSN >= 2^24 - 0x30000で折り返し、一致しないまま
// 読み直しを繰り返す。
/**
 * 読んだ番号(s1)と要求LSN(a1)を比べる7語。IOPアドレスでは`0x2a418`〜`0x2a430`。
 * 3語目と4語目は、IRXを読み込むときに再配置される。そのため、位置を変えずに残す
 */
export const CDVDMAN_SECTOR_ID: IopModulePatch = {
  name: "cdvdman sector ID 24bit",
  imgOffset: 0x26168,
  wordCount: 7,
  sha256: "b2b050062c4984be1bf110e9a1e60f42d33f5c2bd85cdd468d99e5c5aede29ad",
  replace: (original) => [
    subu(reg.v1, reg.s1, reg.a1),
    sll(reg.v1, reg.v1, 8),
    original[2],
    original[3],
    // 分岐先は元の2つの分岐と同じ番地
    beq(reg.v1, reg.zero, 8),
    addu(reg.a2, reg.s1, reg.zero),
    blez(reg.v0, 12),
  ],
};

export const IOP_MODULE_PATCHES = [CDVDFSV_SECTOR_ID, CDVDMAN_SECTOR_ID];

/** IOPモジュールの差し替え範囲を原盤から読み、照合してから差し替えを作る */
export async function readIopModulePatches(
  iopModule: IopModuleFile,
  source: IopSourceReader,
): Promise<SourcePatch[]> {
  const patches: SourcePatch[] = [];
  for (const patch of IOP_MODULE_PATCHES) {
    const { offset, length } = iopPatchRange(patch, iopModule);
    const original = await source.readAt(offset, length);
    patches.push(sourcePatchOf(patch, iopModule, original));
  }
  return patches;
}
