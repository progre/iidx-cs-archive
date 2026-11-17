import type { AssetKind, SongmapSong } from "@csa/core";

/** ディスク配置と同じ順。譜面 → 動画 → BGM → キー音 */
export const KIND_ORDER: AssetKind[] = ["chart", "video", "bgm", "keysound"];

/** file index → その資産を指す欄の名前。同じファイルを複数の欄が指すことがある */
export function collectFields(
  song: SongmapSong,
  kind: AssetKind,
): Map<number, string[]> {
  const fields = new Map<number, string[]>();
  const add = (index: number | null, field: string) => {
    if (index === null) {
      return;
    }
    fields.set(index, [...(fields.get(index) ?? []), field]);
  };
  switch (kind) {
    case "chart":
      for (const [name, chart] of Object.entries(song.charts)) {
        add(chart.chart, name);
      }
      break;
    case "video":
      song.videos.forEach((index, slot) => add(index, String(slot)));
      break;
    case "bgm":
      for (const sound of song.sounds) {
        add(sound.bgm, sound.pair);
      }
      break;
    case "keysound":
      for (const sound of song.sounds) {
        add(sound.keysound, sound.pair);
      }
      break;
  }
  for (const list of fields.values()) {
    list.sort();
  }
  return fields;
}
