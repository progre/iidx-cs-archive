import type { SingleSlot, SizedSlots, Slots } from "@csa/core";

/** 1世代分の、欄の名前から値を引く表 */
export type Row = Record<string, string>;

export function cellOf(row: Row, column: string): string {
  const cell = row[column];
  if (cell == null) {
    throw new Error(`欄が無い: ${column}`);
  }
  return cell;
}

export function optionalNumberOf(row: Row, column: string): number | null {
  const cell = cellOf(row, column);
  if (cell === "") {
    return null;
  }
  const value = Number(cell);
  if (Number.isNaN(value)) {
    throw new Error(`${row.generation}の${column}が数値でない: ${cell}`);
  }
  return value;
}

export function numberOf(row: Row, column: string): number {
  const value = optionalNumberOf(row, column);
  if (value == null) {
    throw new Error(`${row.generation}の${column}が空`);
  }
  return value;
}

/** 空欄はnull */
export function optionalCellOf(row: Row, column: string): string | null {
  const cell = cellOf(row, column);
  return cell === "" ? null : cell;
}

export function booleanOf(row: Row, column: string): boolean {
  const cell = cellOf(row, column);
  if (cell !== "true" && cell !== "false") {
    throw new Error(`${row.generation}の${column}が真偽値でない: ${cell}`);
  }
  return cell === "true";
}

export function slotsOf(row: Row, prefix: string): Slots {
  return {
    offset: numberOf(row, `${prefix}Offset`),
    count: numberOf(row, `${prefix}Count`),
  };
}

export function sizedSlotsOf(row: Row, prefix: string): SizedSlots {
  return { ...slotsOf(row, prefix), bytes: numberOf(row, `${prefix}Bytes`) };
}

export function singleSlotOf(row: Row, prefix: string): SingleSlot {
  return {
    offset: numberOf(row, `${prefix}Offset`),
    bytes: numberOf(row, `${prefix}Bytes`),
  };
}

/** `<prefix>Offset`が空欄の世代は、そのまとまりを持たない */
export function optionalOf<T>(
  row: Row,
  prefix: string,
  of: (row: Row, prefix: string) => T,
): T | null {
  return cellOf(row, `${prefix}Offset`) === "" ? null : of(row, prefix);
}
