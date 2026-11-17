import { addiu, beq, bne, NOP, reg } from "./encode.ts";
import { always, assemble, branchTo, mark, type Piece } from "./assemble.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: ${a} != ${b}`);
}

function assertThrows(fn: () => unknown, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${label}: 例外が出なかった`);
}

Deno.test("assemble: 前と後ろのラベルへの相対offsetを埋める", () => {
  const actual = assemble([
    mark("top"),
    addiu(reg.t0, reg.t0, 1),
    branchTo(bne(reg.t0, reg.t1, 0), "end"),
    NOP,
    ...always("top"),
    mark("end"),
  ]);

  assertEquals(
    actual,
    [
      addiu(reg.t0, reg.t0, 1),
      bne(reg.t0, reg.t1, 3),
      NOP,
      beq(reg.zero, reg.zero, -4),
      NOP,
    ],
    "命令語の並び",
  );
});

Deno.test("assemble: ラベルが重複すると例外", () => {
  assertThrows(() => assemble([mark("a"), mark("a")]), "ラベル重複");
});

Deno.test("assemble: 飛び先のラベルが無いと例外", () => {
  assertThrows(
    () => assemble([branchTo(beq(reg.zero, reg.zero, 0), "no-such-label")]),
    "飛び先無し",
  );
});

Deno.test("assemble: 相対offsetが16bitに収まらないと例外", () => {
  const filler = new Array<Piece>(0x10000).fill(NOP);
  const pieces: Piece[] = [
    branchTo(beq(reg.zero, reg.zero, 0), "far"),
    ...filler,
    mark("far"),
  ];

  assertThrows(() => assemble(pieces), "offset超過");
});
