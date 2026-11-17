export {
  type LoadSegment,
  MutableElf,
  requireWord,
  type WordSource,
} from "./elf.ts";
export {
  hexAddress,
  type InstructionPatch,
  InstructionPatchBook,
  type PatchMetadata,
} from "./patch_book.ts";
export { overwriteCode } from "./overwrite.ts";
export {
  buildMetadata,
  buildRelocations,
  type ElfMetadataPatch,
  type ElfPlacement,
  type ImageElfRecord,
  type PlacedPlan,
  placeElf,
} from "./placement.ts";
export { placeCsaElf } from "./output/mod.ts";
export {
  type FileRelocation,
  relocateFileTable,
  verifyFileTable,
} from "./file_table.ts";
export { buildFakeElf } from "./testing.ts";
