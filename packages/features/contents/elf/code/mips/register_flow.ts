/** 1命令が読み書きするレジスターと、制御を移すかどうか。 */

import { rdOf, rsOf, rtOf } from "./fields.ts";

export type RegisterFlow = Readonly<{
  control: boolean;
  known: boolean;
  reads: readonly number[];
  writes: readonly number[];
}>;

function registers(...values: number[]): number[] {
  return [...new Set(values.filter((value) => value !== 0))].sort((a, b) =>
    a - b
  );
}

function flow(
  reads: readonly number[],
  writes: readonly number[],
  control = false,
  known = true,
): RegisterFlow {
  return {
    control,
    known,
    reads: registers(...reads),
    writes: registers(...writes),
  };
}

function decodeSpecial(word: number): RegisterFlow {
  const source = rsOf(word), target = rtOf(word), destination = rdOf(word);
  const fn = word & 0x3f;
  if (fn <= 0x03 || fn >= 0x38) return flow([target], [destination]);
  if (fn === 0x04 || fn === 0x06 || fn === 0x07) {
    return flow([source, target], [destination]);
  }
  if (fn === 0x08) return flow([source], [], true);
  if (fn === 0x09) return flow([source], [destination || 31], true);
  if (fn === 0x0a || fn === 0x0b) {
    return flow([source, target], [destination]);
  }
  if (fn === 0x0c || fn === 0x0d || fn === 0x0f) return flow([], []);
  if (fn === 0x10 || fn === 0x12) return flow([], [destination]);
  if (fn === 0x11 || fn === 0x13) return flow([source], []);
  if (fn >= 0x18 && fn <= 0x1b) {
    return flow([source, target], destination === 0 ? [] : [destination]);
  }
  if ((fn >= 0x20 && fn <= 0x2f) || (fn >= 0x30 && fn <= 0x36)) {
    return flow([source, target], [destination]);
  }
  return flow([], [], false, false);
}

function decodeRegimm(word: number): RegisterFlow {
  const variant = rtOf(word);
  const link = variant === 0x10 || variant === 0x11 || variant === 0x12 ||
    variant === 0x13;
  return flow([rsOf(word)], link ? [31] : [], true);
}

function decodeCop(word: number): RegisterFlow {
  const source = rsOf(word), target = rtOf(word);
  if (source === 0x08) return flow([], [], true);
  if (source === 0x00 || source === 0x02) return flow([], [target]);
  if (source === 0x04 || source === 0x06) return flow([target], []);
  return flow([], [], false, false);
}

export function decodeRegisterFlow(word: number): RegisterFlow {
  if (word === 0) return flow([], []);
  const op = word >>> 26;
  const source = rsOf(word), target = rtOf(word);
  if (op === 0x00) return decodeSpecial(word);
  if (op === 0x01) return decodeRegimm(word);
  if (op === 0x02) return flow([], [], true);
  if (op === 0x03) return flow([], [31], true);
  if (op >= 0x04 && op <= 0x07) {
    return flow(op <= 0x05 ? [source, target] : [source], [], true);
  }
  if (op >= 0x08 && op <= 0x0e) return flow([source], [target]);
  if (op === 0x0f) return flow([], [target]);
  if (op >= 0x10 && op <= 0x12) return decodeCop(word);
  if (op >= 0x14 && op <= 0x17) {
    return flow(op <= 0x15 ? [source, target] : [source], [], true);
  }
  if (op === 0x18 || op === 0x19) return flow([source], [target]);
  if (op === 0x1a || op === 0x1b) return flow([source, target], [target]);
  if (op === 0x1e) return flow([source], [target]);
  if (op === 0x1f) return flow([source, target], []);
  if (op >= 0x20 && op <= 0x27) {
    const partial = op === 0x22 || op === 0x26;
    return flow(partial ? [source, target] : [source], [target]);
  }
  if (op >= 0x28 && op <= 0x2e) return flow([source, target], []);
  if (op === 0x2f) return flow([source], []);
  if (op === 0x31 || op === 0x32 || op === 0x33 || op === 0x35 || op === 0x36) {
    return flow([source], []);
  }
  if (op === 0x37) return flow([source], [target]);
  if (op === 0x39 || op === 0x3a || op === 0x3d || op === 0x3e) {
    return flow([source], []);
  }
  if (op === 0x3f) return flow([source, target], []);
  return flow([], [], false, false);
}
