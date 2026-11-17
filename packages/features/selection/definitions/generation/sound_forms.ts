// 世代から期待されるキー音・BGM形式と、バイト列から判定した形式の突き合わせ。
// バイト列からの形式判定は contents/sound/convert/form.ts が持つ。

import type { BgmForm, KeysoundForm } from "@csa/core";
import type { Era } from "../table.ts";
import { keysoundFormOf } from "./generations.ts";

const BGM_FORM_BY_ERA: Record<Era, BgmForm> = {
  era1: "bigendian",
  era2: "vig",
  era3: "vig",
};

/** 世代から期待される形式と、判定した形式が食い違えば止める */
export function checkKeysoundForm(
  generation: string,
  detected: KeysoundForm,
): KeysoundForm {
  const expected = keysoundFormOf(generation);
  if (detected !== expected) {
    throw new Error(
      `${generation}のキー音は${expected}のはずが${detected}だった`,
    );
  }
  return detected;
}

export function checkBgmForm(era: Era, detected: BgmForm): BgmForm {
  const expected = BGM_FORM_BY_ERA[era];
  if (detected !== expected) {
    throw new Error(`${era}のBGMは${expected}のはずが${detected}だった`);
  }
  return detected;
}
