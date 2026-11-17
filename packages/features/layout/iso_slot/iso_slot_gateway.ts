// 生成ISOの枠の台帳の読み書き。I/Oだけを行う。

import {
  chooseIsoSlot,
  describeIsoSlots,
  ISO_SLOT_LEDGER_PATH,
  type IsoSlotLedger,
  recordIsoSlot,
} from "./iso_slot.ts";

function readLedger(): IsoSlotLedger {
  try {
    return JSON.parse(Deno.readTextFileSync(ISO_SLOT_LEDGER_PATH));
  } catch {
    return {};
  }
}

/** 書き込む枠を台帳から決める */
export function reserveIsoSlot(): string {
  return chooseIsoSlot(readLedger());
}

/** 書き終えた枠を台帳へ記録する */
export function commitIsoSlot(slot: string, label: string): void {
  const ledger = recordIsoSlot(
    readLedger(),
    slot,
    label,
    new Date().toISOString(),
  );
  Deno.writeTextFileSync(
    ISO_SLOT_LEDGER_PATH,
    JSON.stringify(ledger, null, 2) + "\n",
  );
}

/** 台帳から枠の使用状況を1行で表す */
export function describeLedgerIsoSlots(): string {
  return describeIsoSlots(readLedger());
}
