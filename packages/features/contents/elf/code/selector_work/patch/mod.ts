export { addDirectPatches } from "./patch_direct.ts";
export type { MetadataFactory } from "./patch_direct.ts";
export type { WordAt } from "./patch_high.ts";
export {
  addStackFrameGrowth,
  PB_STACK_FRAME,
  STACK_RECORD_START,
  stackFrameFor,
} from "./stack_frame.ts";
export { addAppendZeroFill, ZERO_FILL_SITES } from "./zero_fill.ts";
