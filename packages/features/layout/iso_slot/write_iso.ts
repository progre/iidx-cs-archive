// ISOを書く手順。既定では1つのファイルへ上書きする。開発者向けに、2つの枠へ交互に書く方法もある。

import { ISO_CONTENT_NAME, ISO_PATH } from "./build_outputs.ts";
import {
  commitIsoSlot,
  describeLedgerIsoSlots,
  reserveIsoSlot,
} from "./iso_slot_gateway.ts";

/** ISOを書き、書いたパスを返す。`useSlot`なら古いほうの枠へ書き、台帳へ記録する */
export async function writeIsoOutput(
  useSlot: boolean,
  log: (line: string) => void,
  write: (path: string) => Promise<void>,
): Promise<string> {
  if (!useSlot) {
    await write(ISO_PATH);
    log(`output: ${ISO_PATH}`);
    return ISO_PATH;
  }
  const slot = reserveIsoSlot();
  await write(slot);
  commitIsoSlot(slot, ISO_CONTENT_NAME);
  log(`output: ${slot} (${ISO_CONTENT_NAME})`);
  log(`ISO slots: ${describeLedgerIsoSlots()}`);
  return slot;
}
