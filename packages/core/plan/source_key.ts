// 変換した生成物・単体ファイルを指す、資産の出どころの名前。
// 原盤ISO内のアーカイブ名と同じ名前空間で引く。
// ここはバイト列にもディスクにも触れず、名前の決まりだけを定める。

/**
 * - `chartBundle`: PB鍵で暗号化した譜面bundle。ファイルは無く、ISOの書き込みのときに1件ずつ作る
 * - `soundBundle`: 世代別に変換したキー音・BGMのbundle
 * - `file`: 任意のファイルを1資産として置く。名前がそのままpathで、offset 0から読む
 */
export type GeneratedSourceKind = "chartBundle" | "soundBundle" | "file";

export type GeneratedSource = { kind: GeneratedSourceKind; name: string };

const PREFIXES: ReadonlyArray<readonly [GeneratedSourceKind, string]> = [
  ["chartBundle", "__pb_chart_bundle__/"],
  ["soundBundle", "__sound_bundle__/"],
  ["file", "__file__/"],
];

/** 生成物の種類と名前から、`sourceArchive`に書く文字列を作る */
export const generatedSourceArchive = (
  kind: GeneratedSourceKind,
  name: string,
): string => PREFIXES.find(([k]) => k === kind)![1] + name;

/** `sourceArchive`から生成物の種類と名前を読み取る。原盤のアーカイブならnull */
export function parseGeneratedSource(archive: string): GeneratedSource | null {
  const found = PREFIXES.find(([, prefix]) => archive.startsWith(prefix));
  if (found === undefined) {
    return null;
  }
  return { kind: found[0], name: archive.slice(found[1].length) };
}
