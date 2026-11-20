// 読む原盤を選ぶ。すべて選んだ状態から始める。必ず読む原盤は、呼び出し側が一覧から除く。

import { Checkbox } from "@cliffy/prompt/checkbox";

/** `titleOf`は、世代の原盤の名前を返す */
export async function selectGenerations(
  generations: readonly string[],
  titleOf: (generation: string) => string,
): Promise<string[]> {
  const selected = await Checkbox.prompt({
    message: "Select the discs you have",
    minOptions: 0,
    options: generations.map((generation) => ({
      checked: true,
      name: titleOf(generation),
      value: generation,
    })),
  });
  return [...selected];
}
