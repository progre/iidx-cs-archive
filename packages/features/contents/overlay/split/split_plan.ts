// 上限を超える曲中オーバーレイを、場面ごとの本へ分ける計算。I/Oは行わない。
// `.if`の読み書きと分け方の選定は`ports`で受ける。ここは呼ぶ順だけを決める。

import type { Animation, IfPackage, OverLimitPackage } from "@csa/core";
import { assertSplitReadable, rewriteSplitMetadata } from "./rewrite.ts";
import { sceneSheets, sceneUsage } from "./usage.ts";

/** 分ける計算が使う、他の feature の関数。実装は app が渡す */
export interface SplitPlanPorts {
  headerBytes: number;
  ifFileNameOf: (fileIndex: number) => string;
  ifFilePathOf: (directory: string, name: string) => string;
  padToSector: (bytes: Uint8Array) => Uint8Array;
  parseAnimations: (metadata: Uint8Array) => Animation[];
  parseIfPackage: (bytes: Uint8Array) => IfPackage;
  parseIfWithAnimations: (bytes: Uint8Array) => {
    animations: Animation[];
    compressed: number[];
    pkg: IfPackage;
  };
  planOverlaySplit: (
    scenes: readonly { animation: number; sheets: ReadonlySet<number> }[],
    sizes: { headerBytes: number; metadata: number; sheets: readonly number[] },
    maxParts: number,
  ) => { animations: number[] }[];
  repackIfPackage: (
    source: Uint8Array,
    metadata: Uint8Array,
    sheets: readonly number[],
  ) => Uint8Array;
}

export interface OverlayPart {
  bytes: Uint8Array;
  /** 元の番号。新しい番号はこの並びの添字 */
  sheets: number[];
  sprites: number[];
}

/** 元の`.if`から、選んだ場面に要るsheetとspriteだけを入れた本を組む */
export function writeOverlayPart(
  ports: SplitPlanPorts,
  source: Uint8Array,
  scenes: Iterable<number>,
): OverlayPart {
  const pkg = ports.parseIfPackage(source);
  const usage = sceneUsage(pkg, ports.parseAnimations(pkg.files[0]), scenes);
  const split = rewriteSplitMetadata(pkg, usage);
  const bytes = ports.repackIfPackage(source, split.metadata, split.sheets);
  assertSplitReadable(ports.parseIfPackage(bytes).metadata, split);
  return { bytes, sheets: split.sheets, sprites: split.sprites };
}

/** 分けた1本。`bytes`は、セクターの境界まで0で埋めてある */
export interface PlannedPart {
  animations: number[];
  bytes: Uint8Array;
}

/** `part`は分けた本の番号 */
export const partPathOf = (
  ports: Pick<SplitPlanPorts, "ifFileNameOf" | "ifFilePathOf">,
  directory: string,
  sourceFileIndex: number,
  part: number,
): string =>
  ports.ifFilePathOf(
    directory,
    `${ports.ifFileNameOf(sourceFileIndex)}_${part}`,
  );

export function planSplitParts(
  ports: SplitPlanPorts,
  source: OverLimitPackage,
  bytes: Uint8Array,
): PlannedPart[] {
  const { animations, compressed, pkg } = ports.parseIfWithAnimations(bytes);
  const [metadata, ...sheets] = compressed;
  return ports.planOverlaySplit(
    sceneSheets(pkg, animations, source.scenes),
    { headerBytes: ports.headerBytes, metadata, sheets },
    source.budget,
  ).map((part) => ({
    animations: part.animations,
    bytes: ports.padToSector(
      writeOverlayPart(ports, bytes, part.animations).bytes,
    ),
  }));
}
