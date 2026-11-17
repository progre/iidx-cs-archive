export {
  always,
  assemble,
  branchTo,
  type LabelBranch,
  type LabelMark,
  mark,
  type Piece,
} from "./assemble.ts";
export {
  branchTarget,
  isBranch,
  isControl,
  isJump,
  isLikely,
  j,
  rebranch,
} from "./control.ts";
export * from "./encode.ts";
export {
  type Decoded,
  decodeFields,
  fnOf,
  hiOf,
  immOf,
  isZeroExt,
  opOf,
  rdOf,
  rsOf,
  rtOf,
  saOf,
  withImmediate,
} from "./fields.ts";
export { decodeRegisterFlow, type RegisterFlow } from "./register_flow.ts";
export { REG_NAMES } from "./tables.ts";
