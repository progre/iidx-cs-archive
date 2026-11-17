/** 音の形式(ADPCM本体・キー音バンク・BGM)の読み書きと判定。 */

export {
  cipherKeysoundChannel,
  encodeRate,
  ERA1_BGM_BLOCK,
  FRAME,
  isSilentFrame,
  reinterleaveBlocksToFrames,
} from "./adpcm.ts";
export {
  convertEra1Bgm,
  type Era1Repacked,
  type Era1RepackOptions,
  type OldBank,
  type OldEntry,
  parseOld,
  repackEra1Keysound,
} from "./era1/mod.ts";
export {
  type ConvertedSound,
  convertSound,
  type Era,
  expectBgmForm,
  expectKeysoundForm,
  sameBytes,
  type SoundKind,
  type SoundRules,
} from "./convert/mod.ts";
export {
  type BgmForm,
  detectBgmForm,
  detectKeysoundForm,
  VIG_MAGIC,
  WP_V3,
} from "./form.ts";
export { printOf, soundPrint } from "./print.ts";
export {
  convertEfBankToWp,
  convertWp2BankToWp3,
  FILE_TABLE,
  KS_TABLE_END,
  type WpBank,
  type WpFileEntry,
} from "./keysound/mod.ts";
export {
  type GenerationBundlePorts,
  type SoundBundlePaths,
  type SoundBundlePorts,
  type SoundOccurrenceList,
  writeGenerationSoundBundle,
  writeKeptBundle,
  writeSoundBundle,
  type WrittenSoundBundle,
} from "./bundle/mod.ts";
