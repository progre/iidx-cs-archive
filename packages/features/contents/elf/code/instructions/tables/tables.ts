/**
 * `data/elf_patch/`のCSVの文字列を、書き換えを作る関数が受け取る表にする。
 * ファイルを開かない。ファイルは`tables_gateway.ts`が読む。
 * 1行目が列名である。`#`で始まる行は読み飛ばす。
 * addressは`0x`付きの16進で書く。負にもなる距離と即値は十進で書く。
 */

import { parse } from "@std/csv";
import {
  BASE_ORIGINS,
  DIRECT_KINDS,
  type DirectGroup,
  type DirectSite,
} from "../../selector_work/allowlist/mod.ts";
import type { SaveDataReference } from "../save/mod.ts";
import type { SiteKind, SongValueSite } from "../song_value/mod.ts";

const KINDS = ["access", "addiu", "addu"] as const;
const SITE_KINDS = ["flags", "items", "modes", "song"] as const;

function parseTable(text: string, columns: readonly string[]): string[][] {
  const [header, ...rows] = parse(text, { comment: "#" });
  if (header?.join(",") !== columns.join(",")) {
    throw new Error("列名が一致しない: " + header?.join(","));
  }
  return rows;
}

function toNumber(cell: string): number {
  const value = Number(cell);
  if (!Number.isInteger(value)) throw new Error("整数ではない: " + cell);
  return value;
}

function toFlag(cell: string): boolean {
  if (cell === "true") return true;
  if (cell === "false") return false;
  throw new Error("真偽値ではない: " + cell);
}

function toEnum<T extends string>(
  cell: string,
  allowed: readonly T[],
): T {
  const found = allowed.find((candidate) => candidate === cell);
  if (found === undefined) throw new Error("列の値が一覧に無い: " + cell);
  return found;
}

const toAddresses = (cell: string) =>
  cell.length === 0 ? [] : cell.split(" ").map(toNumber);

/** `address`の1列だけを持つ表。 */
export function parseAddressTable(text: string): number[] {
  return parseTable(text, ["address"]).map((cells) => toNumber(cells[0]));
}

/** セーブ領域を触る命令の表。列はアルファベット順に並んでいる。 */
export function parseSaveDataReferences(text: string): SaveDataReference[] {
  const columns = [
    "address",
    "built",
    "from",
    "indexed",
    "kind",
    "producers",
    "to",
    "value",
  ];
  return parseTable(text, columns).map((cells) => ({
    address: toNumber(cells[0]),
    built: toNumber(cells[1]),
    from: toNumber(cells[2]),
    indexed: toFlag(cells[3]),
    kind: toEnum(cells[4], KINDS),
    producers: toAddresses(cells[5]),
    to: toNumber(cells[6]),
    value: toNumber(cells[7]),
  }));
}

/** 曲値を触る命令の表。行の並びが重複addressの採用順を決めるので、順序を保つ。 */
/**
 * 選曲ワークを触る命令の許可一覧。関数・基底・種類が同じ行の連なりを1グループにする。
 * 隣り合うグループは、この3列のどれかが必ず違う。
 */
export function parseSelectorWorkDirect(text: string): DirectGroup[] {
  const columns = [
    "address",
    "base_origin",
    "function",
    "high_address",
    "kind",
    "old_reference",
  ];
  const groups: DirectGroup[] = [];
  let sites: DirectSite[] = [];
  for (const cells of parseTable(text, columns)) {
    const baseOrigin = toEnum(cells[1], BASE_ORIGINS);
    const functionName = cells[2];
    const kind = toEnum(cells[4], DIRECT_KINDS);
    const site: DirectSite = [
      toNumber(cells[0]),
      toNumber(cells[5]),
      toNumber(cells[3]),
    ];
    const last = groups.at(-1);
    if (
      last?.functionName === functionName && last.baseOrigin === baseOrigin &&
      last.kind === kind
    ) {
      sites.push(site);
      continue;
    }
    sites = [site];
    groups.push({ baseOrigin, functionName, kind, sites });
  }
  return groups;
}

export function parseSongValueSites(text: string): SongValueSite[] {
  return parseTable(text, ["address", "kind", "second"]).map((cells) => ({
    address: toNumber(cells[0]),
    kind: toEnum<SiteKind>(cells[1], SITE_KINDS),
    second: toFlag(cells[2]),
  }));
}
