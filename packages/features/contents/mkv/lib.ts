// 原盤のMPEG-PSのムービーを、再エンコードせずにmkvへ入れ替える。通常のビルドでは使わない。
export { writeMkv } from "./mkv_gateway.ts";
export { isMpegPs, MPEG_PS_HEAD_BYTES } from "./mpeg_ps.ts";
