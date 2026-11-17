/** era1ムービーの採用規則と、変換結果の検査。 */

export {
  buildEra1Source,
  type Era1SongRecord,
  formatKeyOf,
  formatOf,
  selectEra1Jobs,
  selectEra1JobsOf,
  sourceKeyOf,
  squareCrop,
  standardBand,
  videoKeyOf,
} from "./adoption/mod.ts";
export {
  cropFilter,
  ENCODE_ARGS,
  findProblems,
  labelOf,
  metaTextOf,
  outputPathOf,
  type PssFacts,
  reportLineOf,
} from "./conversion.ts";
export { checkConvertedReport } from "./conversion.ts";
export { metaPathOf, mp4JobOf, mp4NameOf } from "./mp4_job.ts";
export type {
  Crop,
  Era1Job,
  Era1Song,
  Era1Source,
  Era1Video,
} from "./types.ts";
