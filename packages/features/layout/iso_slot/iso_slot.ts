// 生成ISOは2枠を交互に使う。直前に作った1本はPCSX2が掴んでいることがあるため、
// 常に古いほうの枠へ書く。過去のISOも2本より増えない。
//
// 台帳`build/iso_slots.json`に、どの枠にどの構成が入っているかを記録する。
// このファイルは台帳の値から枠を決めるだけで、台帳の読み書きはしない。

import { BUILD_DIRECTORY } from "@csa/core";

export const ISO_SLOTS = [
  `${BUILD_DIRECTORY}/slot_a.iso`,
  `${BUILD_DIRECTORY}/slot_b.iso`,
];
export const ISO_SLOT_LEDGER_PATH = `${BUILD_DIRECTORY}/iso_slots.json`;

export interface IsoSlotEntry {
  label: string;
  written: string;
}
export type IsoSlotLedger = Record<string, IsoSlotEntry>;

/** 書き込む枠を決める。台帳に無い枠を先に使い、両方埋まっていれば古いほうを使う */
export function chooseIsoSlot(ledger: IsoSlotLedger): string {
  const empty = ISO_SLOTS.find((slot) => ledger[slot] === undefined);
  if (empty !== undefined) {
    return empty;
  }
  // 同じ構成を作り直すときも、新しいほうは掴まれている前提で古いほうへ書く
  const [older] = [...ISO_SLOTS].sort((a, b) =>
    ledger[a].written.localeCompare(ledger[b].written)
  );
  return older;
}

/** 書き終えた枠を記録した台帳を返す。元の台帳は変えない */
export function recordIsoSlot(
  ledger: IsoSlotLedger,
  slot: string,
  label: string,
  written: string,
): IsoSlotLedger {
  return { ...ledger, [slot]: { label, written } };
}

/** 枠の使用状況を1行で表す */
export function describeIsoSlots(ledger: IsoSlotLedger): string {
  return ISO_SLOTS.map((slot) => `${slot}=${ledger[slot]?.label ?? "(empty)"}`)
    .join(" / ");
}
