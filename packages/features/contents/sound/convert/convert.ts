// 音声資産の変換入口。世代名とバイト列だけで経路が決まり、曲ごとの判断を挟まない。
// 世代からeraと期待する形式を決める規則は、呼び出し側が`SoundRules`で渡す。

import type { BgmForm, KeysoundForm } from "@csa/core";
import { convertEra1Bgm, repackEra1Keysound } from "../era1/mod.ts";
import { detectBgmForm, detectKeysoundForm } from "../form.ts";
import { convertEfBankToWp, convertWp2BankToWp3 } from "../keysound/mod.ts";

export type Era = "era1" | "era2" | "era3";

export type SoundKind = "bgm" | "keysound";

/** 世代の決まりごと。判断は呼び出し側が持つ */
export interface SoundRules {
  /** 世代のeraを返す。未登録の世代は例外にする */
  eraOf: (generation: string) => Era;
  /** 世代から期待される形式と食い違えば例外にする。判定した形式を返す */
  checkBgmForm: (era: Era, detected: BgmForm) => BgmForm;
  checkKeysoundForm: (
    generation: string,
    detected: KeysoundForm,
  ) => KeysoundForm;
  /** 原作のドライバーが、同じ番号のキー音の鳴らし直しで前の音を止める世代か */
  keysoundRetriggerCutOf: (generation: string) => boolean;
}

export interface ConvertedSound {
  bytes: Uint8Array;
  era: Era;
  /**
   * era1キー音だけが持つ、旧 `entry_id` → 新 `entry_id` の対応。
   * 同じ曲の譜面の `sound_id` をこの写像で書き換える
   */
  soundMap?: Record<string, number>;
}

/** 世代から期待される形式と、バイト列から判定した形式が食い違えば止める */
export function expectKeysoundForm(
  rules: Pick<SoundRules, "checkKeysoundForm">,
  generation: string,
  buf: Uint8Array,
  totalLength = buf.length,
): KeysoundForm {
  return rules.checkKeysoundForm(
    generation,
    detectKeysoundForm(buf, totalLength),
  );
}

export function expectBgmForm(
  rules: Pick<SoundRules, "checkBgmForm">,
  era: Era,
  buf: Uint8Array,
  totalLength = buf.length,
): BgmForm {
  return rules.checkBgmForm(era, detectBgmForm(buf, totalLength));
}

/** キー音バンクはeraでなく形式(世代表と突き合わせ済み)で経路が決まる */
function convertKeysound(
  rules: SoundRules,
  era: Era,
  generation: string,
  bytes: Uint8Array,
): ConvertedSound {
  switch (expectKeysoundForm(rules, generation, bytes)) {
    case "headerless": {
      const repacked = repackEra1Keysound(bytes, {
        cutOnRetrigger: rules.keysoundRetriggerCutOf(generation),
      });
      return { bytes: repacked.bytes, era, soundMap: repacked.soundMap };
    }
    case "ef1":
      return { bytes: convertEfBankToWp(bytes), era };
    case "wp2":
      return { bytes: convertWp2BankToWp3(bytes), era };
    case "wp3":
      return { bytes, era };
  }
}

function convertBgm(
  rules: SoundRules,
  era: Era,
  bytes: Uint8Array,
): ConvertedSound {
  expectBgmForm(rules, era, bytes);
  return {
    bytes: era === "era1" ? convertEra1Bgm(bytes) : bytes,
    era,
  };
}

/**
 * 素材世代の音声1ファイルを、PBのABC連結空間へそのまま追記できるバイト列にする。
 * 形式を変える変換(era1、ef v1、wp v2)は、`0x800 + filesize` (BGM) または
 * `file_entries` 終端 + `data_total` (キー音) ちょうどの長さで返す。
 * 形式が同じ音(era2/era3のBGM、wp v3のキー音)は、末尾の余りも含めて原盤のまま返す。
 */
export function convertSound(
  rules: SoundRules,
  kind: SoundKind,
  generation: string,
  bytes: Uint8Array,
): ConvertedSound {
  const era = rules.eraOf(generation);
  return kind === "keysound"
    ? convertKeysound(rules, era, generation, bytes)
    : convertBgm(rules, era, bytes);
}

export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
