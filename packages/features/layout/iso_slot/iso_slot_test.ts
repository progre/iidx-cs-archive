import { assertEquals } from "@std/assert";
import {
  chooseIsoSlot,
  describeIsoSlots,
  type IsoSlotLedger,
  recordIsoSlot,
} from "./iso_slot.ts";

const A = "build/slot_a.iso";
const B = "build/slot_b.iso";

Deno.test("台帳が空なら先頭の枠を使う", () => {
  assertEquals(chooseIsoSlot({}), A);
});

Deno.test("片方だけ埋まっていれば、空いている枠を使う", () => {
  const ledger: IsoSlotLedger = { [A]: { label: "x", written: "2026-01-01" } };
  assertEquals(chooseIsoSlot(ledger), B);
});

Deno.test("両方埋まっていれば、書き込みの古い枠を使う", () => {
  const ledger: IsoSlotLedger = {
    [A]: { label: "x", written: "2026-01-02" },
    [B]: { label: "y", written: "2026-01-01" },
  };
  assertEquals(chooseIsoSlot(ledger), B);
});

Deno.test("記録は元の台帳を変えずに、枠の内容を置き換える", () => {
  const ledger: IsoSlotLedger = { [A]: { label: "x", written: "t1" } };
  const next = recordIsoSlot(ledger, A, "z", "t2");
  assertEquals(next[A], { label: "z", written: "t2" });
  assertEquals(ledger[A], { label: "x", written: "t1" });
});

Deno.test("使用状況は空の枠を(empty)と表す", () => {
  const ledger: IsoSlotLedger = { [A]: { label: "x", written: "t" } };
  assertEquals(
    describeIsoSlots(ledger),
    `${A}=x / ${B}=(empty)`,
  );
});
