/**
 * 書き換えの`usage`が選曲record容量`E`で動く欄かを見分ける。
 * 曲数`N`で動く欄と同じ命令へ同居すると、片方の容量だけを変えられなくなるので止める。
 */

/** record、int表、copy長と、その間に挟まれて`E`で位置が動く固定member。 */
const ENTRIES_USAGES = new Set([
  "builtFlag",
  "entries",
  "externalListEntries",
  "fiveRecords",
  "fourEntries",
  "recordSize",
  "recordStrideShift",
  "records",
  "states",
  "table0",
  "table1",
  "table2",
  "table4",
  "tail",
  "terminalRecord",
]);

/** 曲数で伸びる表のstride。 */
const STRIDE_USAGES = new Set([
  "fourSongs",
  "fourSongsStrideMultiply",
  "fourSongsStrideShift",
  "twentySongs",
  "twentySongsStrideMultiply",
]);

export function isEntriesDependent(usage: string): boolean {
  // 共有luiは`a+b`、同一命令への重ね掛けは`a + b`へ統合される
  const usages = usage.split("+").map((item) => item.trim());
  const entries = usages.some((item) => ENTRIES_USAGES.has(item));
  const stride = usages.some((item) => STRIDE_USAGES.has(item));
  if (entries && stride) {
    throw new Error("容量で動く欄と曲数で動く欄が同じ命令にある: " + usage);
  }
  return entries;
}
