// 単独で実行するコマンドの引数の解釈。副作用は持たない。

export function parseExportMp4Args(
  args: readonly string[],
): { outDir: string; pssDir: string } {
  const [pssDir, outDir] = args;
  if (!outDir) {
    throw new Error("<pss dir> <out dir>を指定する");
  }
  return { outDir, pssDir };
}

export function parseSliceIsoFileArgs(args: readonly string[]): {
  archiveName: string;
  generation: string;
  offset: number;
  outputPath: string;
  size: number;
} {
  const [generation, archiveName, offsetArgument, sizeArgument, outputPath] =
    args;
  if (!outputPath) {
    throw new Error("<世代> <archive> <offset> <size> <out>を指定する");
  }
  return {
    archiveName,
    generation,
    offset: Number(offsetArgument),
    outputPath,
    size: Number(sizeArgument),
  };
}
