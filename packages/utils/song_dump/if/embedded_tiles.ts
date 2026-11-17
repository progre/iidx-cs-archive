// ELFに埋め込まれたlegacy tileを、世代ごとに1つのフォルダーへ書く。
// 埋め込みのtileは複数の曲が使い回すので、曲ごとには書かない。
// どの曲がどの組と選択子を使うかは、embedded_tiles.csvへ書く。

import { stringify } from "@std/csv";
import { join } from "@std/path";
import { embeddedTileDirNameOf } from "../song.ts";
import type { Song } from "../song.ts";
import { type Combo, combosOf, writeCombos } from "./expand_ifs.ts";
import type { LegacyTables } from "./legacy_tables.ts";

const COLUMNS = ["generation", "index", "title", "set", "selector"];

/** 同じ組と選択子のtile番号を曲をまたいで合わせ、重複を除いて通し番号順にする */
function mergedOf(combos: Combo[]): Combo[] {
  const merged = new Map<string, Combo>();
  combos.forEach((combo) => {
    const key = `${combo.set}_${combo.selector}`;
    const tiles = [...merged.get(key)?.tiles ?? [], ...combo.tiles];
    merged.set(key, {
      ...combo,
      tiles: [...new Set(tiles)].sort((a, b) => a - b),
    });
  });
  return [...merged.values()];
}

export class EmbeddedTileDump {
  private readonly rows: Record<string, string | number>[] = [];

  constructor(private readonly out: string) {}

  /** 埋め込みのtileを使う曲が無い世代は、フォルダーを作らない */
  async dump(generation: string, songs: Song[], legacy: LegacyTables) {
    const users = songs
      .map((song) => ({
        song,
        combos: combosOf(
          legacy.spritesOf(song.record),
          (n) => legacy.embeddedTileOf(n) != null,
        ),
      }))
      .filter(({ combos }) => combos.length > 0);
    if (users.length === 0) {
      return;
    }
    users.forEach(({ song, combos }) =>
      combos.forEach(({ set, selector }) =>
        this.rows.push({
          generation,
          index: song.index,
          title: song.record.title.text,
          set,
          selector,
        })
      )
    );
    const dir = join(this.out, embeddedTileDirNameOf(generation));
    await Deno.mkdir(dir, { recursive: true });
    const combos = mergedOf(users.flatMap((user) => user.combos));
    await writeCombos(dir, combos, legacy, legacy.embeddedTileOf);
  }

  async writeIndex() {
    if (this.rows.length === 0) {
      return;
    }
    const csv = stringify(this.rows, { columns: COLUMNS });
    await Deno.writeTextFile(join(this.out, "embedded_tiles.csv"), csv);
  }
}
