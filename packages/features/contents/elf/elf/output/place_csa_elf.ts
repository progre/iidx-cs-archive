// 組み上げたCSAのELFの位置を決め、内蔵ファイル表へ書き込み、中間ファイルとして書く。
// 長さが決まってから位置が決まる。ファイル表を書き込んでも、ELFの長さは変わらない。

import { MutableElf } from "../elf.ts";
import { relocateFileTable } from "../file_table.ts";
import {
  buildMetadata,
  buildRelocations,
  type ImageElfRecord,
  type PlacedPlan,
  placeElf,
} from "../placement.ts";
import { writeCsaElf } from "./csa_elf_gateway.ts";

export function placeCsaElf(
  built: Uint8Array,
  plan: PlacedPlan,
  image: ImageElfRecord,
  elfName: string,
) {
  const elfPlacement = placeElf(plan, built.length);
  const relocations = buildRelocations(image, elfPlacement, elfName);
  const metadata = buildMetadata(image, elfPlacement, built.length);
  const outputElf = new MutableElf(built);
  relocateFileTable(outputElf, relocations);
  writeCsaElf(elfName, outputElf.bytes);
  return { elfPlacement, metadata, outputElf, relocations };
}
