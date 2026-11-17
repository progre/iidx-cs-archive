// 原盤のMPEG-PSを、再エンコードせずにmkvへ入れ替えるときの判定とffmpegの引数。

const PACK_START = [0x00, 0x00, 0x01, 0xba];

/** 判定に要る先頭のバイト数 */
export const MPEG_PS_HEAD_BYTES = PACK_START.length;

/** MPEG-PSのパックヘッダーで始まるか */
export const isMpegPs = (bytes: Uint8Array): boolean =>
  PACK_START.every((byte, i) => bytes[i] === byte);

/**
 * 標準入力からMPEG-PSを読み、全ストリームを写すffmpegの引数。
 * 原盤のMPEG-PSには、PTSを持たないコマがある。
 * そのため、-fflags +genptsを付けないとmatroskaへ書けない
 */
const copyArgs = (output: readonly string[]): string[] => [
  "-y",
  "-loglevel",
  "error",
  "-fflags",
  "+genpts",
  "-f",
  "mpeg",
  "-i",
  "pipe:0",
  "-c",
  "copy",
  ...output,
];

/**
 * 原盤の表示比は実態と合わない。そこで、sequence headerの表示比を正方画素へ書き換える。
 * 書き換えたMPEG-PSを標準出力へ出す
 */
export const squareArgs = (): string[] =>
  copyArgs([
    "-bsf:v",
    "mpeg2_metadata=display_aspect_ratio=1/1",
    "-f",
    "mpeg",
    "pipe:1",
  ]);

/** mkvの表示比は、ffmpegが入力を読んだ時点の値になる。そのため、書き換えたMPEG-PSは2つ目のffmpegでmkvへ入れる */
export const muxArgs = (outPath: string): string[] => copyArgs([outPath]);
