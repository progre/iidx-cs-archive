// era1ムービーの変換で読み書きするファイル。I/Oだけを行う。

import { dirname } from "@std/path";

/** 検査結果の`.json`が既にあれば、変換済みとみなす */
export function isConverted(output: string): boolean {
  try {
    Deno.statSync(output + ".json");
    return true;
  } catch {
    return false;
  }
}

export const fileExists = (path: string): boolean => {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
};

/** 変換結果の隣に書いた、検査結果の`.json`の文字列 */
export const readReportText = (output: string): string =>
  Deno.readTextFileSync(output + ".json");

export const makeDirectory = (directory: string): void =>
  Deno.mkdirSync(directory, { recursive: true });

export const writeTempFile = (path: string, bytes: Uint8Array): void =>
  Deno.writeFileSync(path, bytes);

export const readTempFile = (path: string): Uint8Array =>
  Deno.readFileSync(path);

/** 変換結果のPSSと、同名の`.json`を書く */
export function writeConverted(
  output: string,
  pss: Uint8Array,
  metaText: string,
): void {
  makeDirectory(dirname(output));
  Deno.writeFileSync(output, pss);
  Deno.writeTextFileSync(output + ".json", metaText);
}

/** 変換結果のPSSの大きさ */
export const convertedSize = (output: string): number =>
  Deno.statSync(output).size;

/** 変換結果のPSS */
export const readConverted = (output: string): Uint8Array =>
  Deno.readFileSync(output);

export const removeTempFile = (path: string): void => Deno.removeSync(path);

/** 空でない、または既に無いときは、そのままにする */
export function removeEmptyDirectory(directory: string): void {
  try {
    Deno.removeSync(directory);
  } catch {
    // 何もしない
  }
}
