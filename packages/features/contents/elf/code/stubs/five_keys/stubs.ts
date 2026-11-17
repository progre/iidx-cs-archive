// 4つのstubをコード領域へ並べる。stubは入口のアドレスごとに`jal`で呼ばれる。

import {
  fieldStubWords,
  playStubWords,
  recordStubWords,
  registerStubWords,
} from "./song_stubs.ts";
import { cursorStubWords, rebuildStubWords } from "./switch_stubs.ts";
import { packSlot } from "../area.ts";
import { CODE_SLOT } from "./table.ts";

export type StubName =
  | "cursor"
  | "field"
  | "play"
  | "rebuild"
  | "record"
  | "register";

export interface FiveKeysStub {
  name: StubName;
  vaddr: number;
  words: number[];
}

const BUILDERS: [StubName, () => number[]][] = [
  ["rebuild", rebuildStubWords],
  ["cursor", cursorStubWords],
  ["register", registerStubWords],
  ["record", recordStubWords],
  ["play", playStubWords],
  ["field", fieldStubWords],
];

/** stub同士は呼び合わないので、並べる順序に意味は無い */
export function fiveKeysStubs(): FiveKeysStub[] {
  const built = BUILDERS.map(([name, build]) => ({ name, words: build() }));
  const vaddrs = packSlot(CODE_SLOT, built.map((stub) => stub.words));
  return built.map((stub, index) => ({ ...stub, vaddr: vaddrs[index] }));
}
