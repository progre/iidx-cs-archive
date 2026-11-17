/**
 * 選曲ワークを触る命令の許可一覧の型。表は命令語を持たず、addressと参照先だけを持つ。
 * 書き換え前の命令語は毎回ELFから読む。
 */

export const BASE_ORIGINS = ["allocation-owner", "work-argument"] as const;
export type BaseOrigin = typeof BASE_ORIGINS[number];

export const DIRECT_KINDS = [
  "allocation",
  "builtFlag",
  "cacheA",
  "cacheB",
  "cacheC",
  "cacheCThreeFourSongs",
  "entries",
  "externalListEntries",
  "fiveRecords",
  "fourEntries",
  "recordSize",
  "records",
  "secondaryA",
  "secondaryB",
  "songDifficulty",
  "states",
  "table0",
  "table1",
  "table2",
  "table4",
  "tail",
  "terminalRecord",
  "twentySongs",
] as const;
export type DirectKind = typeof DIRECT_KINDS[number];

/** `highAddress`が0なら`lui`を持たない単独の16bit即値。 */
export type DirectSite = readonly [
  address: number,
  oldReference: number,
  highAddress: number,
];

export type DirectGroup = Readonly<{
  baseOrigin: BaseOrigin;
  functionName: string;
  kind: DirectKind;
  sites: readonly DirectSite[];
}>;

export type RewriteKind =
  | "fourSongsStrideMultiply"
  | "fourSongsStrideShift"
  | "recordStrideShift"
  | "twentySongsStrideMultiply";
export type RewriteStrategy =
  | "multiplyCoupledFirst"
  | "multiplyCoupledSecond"
  | "multiplyDeferred"
  | "multiplyEarly"
  | "shift"
  | "shiftSourceEarly";

export type RewriteGroup = Readonly<{
  functionName: string;
  kind: RewriteKind;
  /** 組み替える5命令のaddress。 */
  sites: readonly number[];
  strategy: RewriteStrategy;
}>;
export type RewriteBatch = readonly [
  functionName: string,
  kind: RewriteKind,
  strategy: RewriteStrategy,
  groupCount: number,
];
export type RewriteCoupling = readonly [
  firstGroupAddress: number,
  secondGroupAddress: number,
];
export type HighSplit = readonly [
  functionName: string,
  sharedHighAddress: number,
  splitAddress: number,
  detachedLowAddress: number,
];
/** 同じ低位命令に別経路から届く `lui`。登録highと同じ上位16bitに揃える。 */
export type HighAlias = readonly [
  functionName: string,
  lowAddress: number,
  aliasAddress: number,
];

export type Region = readonly [DirectKind, number, number];

export const PB_REGIONS: readonly Region[] = [
  ["records", 0x00000, 0x2ee00],
  ["table0", 0x2ee00, 0x2f5bc],
  ["table1", 0x2f5bc, 0x2fd78],
  ["table2", 0x2fd78, 0x30534],
  ["songDifficulty", 0x30534, 0x30cf0],
  ["terminalRecord", 0x30cf0, 0x310d8],
  ["table4", 0x310d8, 0x31894],
  ["states", 0x31894, 0x318a8],
  ["cacheA", 0x318a8, 0x32064],
  ["cacheB", 0x32064, 0x32820],
  ["cacheC", 0x32820, 0x32fdc],
  ["builtFlag", 0x32fdc, 0x32fe0],
  ["secondaryA", 0x32fe0, 0x3568c],
  ["secondaryB", 0x3568c, 0x37d38],
  ["tail", 0x37d38, 0x37d50],
];

export function unpackRewriteGroups(
  batches: readonly RewriteBatch[],
  rows: readonly string[],
): readonly RewriteGroup[] {
  const groups: RewriteGroup[] = [];
  let offset = 0;
  for (const [functionName, kind, strategy, groupCount] of batches) {
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const row = rows[offset++];
      if (row === undefined) throw new Error("rewrite rowが不足しています");
      const sites = row.split(",").map((address): number => {
        if (!/^[0-9a-f]{8}$/.test(address)) {
          throw new Error(`rewrite rowの形式が不正です: ${address}`);
        }
        return Number.parseInt(address, 16);
      });
      if (sites.length !== 5) {
        throw new Error("rewrite groupは5命令ではありません");
      }
      groups.push({ functionName, kind, sites, strategy });
    }
  }
  if (offset !== rows.length) throw new Error("未使用のrewrite rowがあります");
  return groups;
}
