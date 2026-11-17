// era1のキー音の群を、PBで原作と同じ止め方になる群へ直す。
// era1は0と255を群なしとし、PBは255だけを群なしとする。

const PB_NO_GROUP = 0xff;
const isNoGroup = (group: number) => group === 0 || group === PB_NO_GROUP;

/**
 * 旧エントリの群(`+0x04`)の並びから、PBの群(`+0x01`)の並びを求める。
 * `cutOnRetrigger`の世代は、同じ番号の音を鳴らし直すと前の音を止める。
 * PBで同じ止め方にするため、群なしの音にバンクの中で使われていない群を1つずつ割り当てる。
 * 群を持つ音は、同じ群の音として鳴らし直しでも止まる
 */
export function era1GroupsOf(
  groups: readonly number[],
  cutOnRetrigger: boolean,
): number[] {
  if (!cutOnRetrigger) {
    return groups.map((group) => (isNoGroup(group) ? PB_NO_GROUP : group));
  }
  const used = new Set(groups.filter((group) => !isNoGroup(group)));
  const free = Array.from({ length: PB_NO_GROUP }, (_, group) => group)
    .filter((group) => !used.has(group));
  let next = 0;
  return groups.map((group) => {
    if (!isNoGroup(group)) {
      return group;
    }
    if (next >= free.length) {
      throw new Error("鳴らし直しで止める音に割り当てる群が足りない");
    }
    return free[next++];
  });
}
