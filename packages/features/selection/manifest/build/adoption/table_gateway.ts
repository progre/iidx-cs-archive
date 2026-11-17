// 同じ内容のムービーの差し替え表の読み込み。I/Oだけを行う。

const TABLE_PATH = "data/video_adoptions.csv";

export const readVideoAdoptionTable = (): string =>
  Deno.readTextFileSync(TABLE_PATH);
