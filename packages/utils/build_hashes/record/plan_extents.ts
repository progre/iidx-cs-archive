import { SEC } from "@csa/core";

/** ISO の絶対 LBA に置かれた資産1件。key は配置に依らない呼び名 */
export interface Extent {
  key: string;
  lba: number;
  size: number;
}

interface PlannedAsset {
  newAbcIndex: number;
  lba: number;
  sourceSize: number;
}

interface PlannedPackage {
  newData1Index: number;
  lba: number;
  sectors: number;
}

interface PlannedImageSet {
  data1Index: number;
  lba: number;
  size: number;
}

function jsonOf<T>(cell: string | undefined): T | undefined {
  return cell === undefined || cell === "" || cell === "-"
    ? undefined
    : JSON.parse(cell) as T;
}

function songExtents(cells: string[]): Extent[] {
  const assets = jsonOf<PlannedAsset[]>(cells[6]) ?? [];
  const card = jsonOf<PlannedPackage>(cells[7]);
  const overlay = jsonOf<{ packages: PlannedPackage[] }>(cells[8]);
  const packages = (kind: string, items: PlannedPackage[]): Extent[] =>
    items.map((item) => ({
      key: `data1/${kind}/${item.newData1Index}`,
      lba: item.lba,
      size: item.sectors * SEC,
    }));
  return [
    ...assets.map((asset) => ({
      key: `abc/${asset.newAbcIndex}`,
      lba: asset.lba,
      size: asset.sourceSize,
    })),
    ...packages("title_card", card ? [card] : []),
    ...packages("overlay", overlay?.packages ?? []),
  ];
}

function imageSetExtents(cells: string[]): Extent[] {
  return (jsonOf<PlannedImageSet[]>(cells[7]) ?? []).map((item) => ({
    key: `data1/image_set/${item.data1Index}`,
    lba: item.lba,
    size: item.size,
  }));
}

/** 配置計画の TSV から、重複を除いた資産の位置を key の昇順で返す */
export function extentsOfPlan(tsv: string): Extent[] {
  const found = new Map<string, Extent>();
  for (const line of tsv.split("\n").slice(1)) {
    const cells = line.split("\t");
    const extents = cells[0] === "song"
      ? songExtents(cells)
      : cells[0] === "data1"
      ? imageSetExtents(cells)
      : [];
    extents.forEach((extent) => found.set(extent.key, extent));
  }
  return [...found.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}
