// 素材世代の作品番号を、CSAの作品番号へ直す規則。
// 曲DBの置き場・1件の長さ・欄の位置は、世代ごとの定義(`ElfDefinition`)が持つ。

import type { SourceOrigin } from "@csa/core";
import { versionFolder, versionOfFolderName } from "./folders.ts";

// 3rd・5th〜7thの素材が持つ新旧の印。印の表記と、そこから決まる作品番号を
// ここだけで持つ。
const OLD = 0;
const CS = 2;

/** 3rdの2はCS新曲ではなく、CS 3rdが収録した1st styleの曲である */
const THIRD_LABELS = ["旧", "新", "1st"];
const LABELS = ["旧", "新", "CS"];

/** 曲リストの原作フォルダー欄に出す印 */
export const newOldLabel = (generation: string, mark: number): string =>
  (generation === "3rd" ? THIRD_LABELS : LABELS)[mark];

/** 印から決まる作品番号。旧曲はどの作品が初出か印だけでは決まらない */
export function markedVersion(
  generation: string,
  mark: number,
): number | undefined {
  if (mark === OLD) return undefined;
  if (mark === CS && generation === "3rd") return versionOfFolderName("1st");
  return generationNumber(generation);
}

/** 同じ管理名の曲からも決まらなかった曲の作品番号 */
export const unmarkedVersion = (
  generation: string,
  mark: number | undefined,
): number => generationNumber(generation) - (mark === OLD ? 1 : 0);

/** 曲リストの原作フォルダー欄。作品番号なら枠、新旧の印ならその印の文字 */
export function sourceFolderOf(
  generation: string,
  { newOld, sourceVersion }: SourceOrigin,
): number | string | undefined {
  if (sourceVersion !== undefined) {
    return versionFolder(sourceVersionToCsa(generation, sourceVersion));
  }
  return newOld === undefined ? undefined : newOldLabel(generation, newOld);
}

/**
 * 作品番号の1が1st styleを、2がsubstreamを指す世代。この並びの世代は8thだけである。
 * PBは、この2つを1つの値にまとめている
 */
const SPLITS_SUBSTREAM = new Set(["8th"]);

/**
 * 素材の作品番号をCSAの並びへ直す。
 * CSAは、枠を作品番号+1の1本で決める。そのため、1st styleは0、substreamは1になる。
 * 8thの素材は、その2つを1と2で分けているので、1つずらす。
 * 他の世代の1は、その世代のELFがindexで分けていた値である。この値は1st styleとして扱う
 */
export function sourceVersionToCsa(
  generation: string,
  version: number,
): number {
  if (SPLITS_SUBSTREAM.has(generation)) {
    return version <= 2 ? version - 1 : version;
  }
  return version === 1 ? 0 : version;
}

/** USはACに対応する作品が無いので、この枠に入れる(2026-09-15、ユーザー決定) */
const US_FOLDER = "red";

/**
 * 作品番号を決める材料が無い曲に書く作品番号。
 * 材料が無いとは、収録表に指定が無く、9th以降の同名曲からも引き継げないことである。
 * 3rd〜8thは収録作品の番号を書く(暫定)。世代IDは枠の略号と同じ綴りなので、略号から引く
 */
export const generationNumber = (generation: string): number =>
  versionOfFolderName(generation === "us" ? US_FOLDER : generation);
