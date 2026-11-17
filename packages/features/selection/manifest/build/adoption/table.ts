// 同じ内容のムービーの差し替え表を読み、曲の名前を世代とsong_idに変換する。
// 表は調査用のスクリプトが作った。
// `slot`列と`adopt_slot`列は、曲の何本目のムービーかを表す。
// `slot`は、ムービーを2本載せる曲で、どちらを差し替えるかを決めるのに使う。
// `adopt_slot`は、採用元の曲がムービーを2本載せるときに、どちらを使うかを決める。列が無ければ1本目である。
// `alias`列は、採用元をムービーの別名で書く。採用するのは、`movie_alias.csv`で別名の`pick`に`*`を書いた1本である。
// 1行には`adopt`と`alias`のどちらか一方を書く。

import { parse } from "@std/csv";
import type { IndexDoc } from "../../index/mod.ts";

export interface SongId {
  generation: string;
  songId: number;
}

export interface VideoAdoption {
  song: SongId;
  /** `song`の何本目のムービーを差し替えるか。songmapの曲の`videos`の添字である */
  slot: number;
  /** 代わりにムービーを使う曲 */
  adopt: SongId;
  /** `adopt`の何本目のムービーを使うか */
  adoptSlot: number;
}

/** 採用元を別名で書いた行。別名から採用元の曲を引くのは、ビルドが行う */
export interface AliasAdoption {
  song: SongId;
  slot: number;
  alias: string;
}

export type VideoAdoptionRow = VideoAdoption | AliasAdoption;

function fail(message: string): never {
  throw new Error(message);
}

/**
 * `<世代>:<管理名>`を、世代とsong_idに変換する。
 * 同じ世代に同じ管理名の曲が複数あれば、`#<song_id>`が付く。
 * 題名が空白で索引に載らない曲は、管理名が`<世代>:<song_id>`になる。
 */
function resolverOf(index: IndexDoc) {
  return (name: string): SongId => {
    const generation = name.slice(0, name.indexOf(":"));
    const rest = name.slice(generation.length + 1);
    const [key, id] = rest.split("#");
    if (id !== undefined) {
      return { generation, songId: Number(id) };
    }
    if (key.startsWith(`${generation}:`)) {
      return { generation, songId: Number(key.slice(generation.length + 1)) };
    }
    const songs = index.songs[key]?.generations[generation] ??
      fail(`差し替え表の曲が索引に無い: ${name}`);
    if (songs.length !== 1) {
      fail(`差し替え表の曲が1つに決まらない: ${name}`);
    }
    return { generation, songId: songs[0].song_id };
  };
}

/** 差し替え表のCSVの文章を、採用の一覧にする */
export function videoAdoptionsOf(
  csvText: string,
  index: IndexDoc,
): VideoAdoptionRow[] {
  const resolve = resolverOf(index);
  return parse(csvText, { skipFirstRow: true }).map((row) => {
    const song = resolve(row.song);
    const slot = Number(row.slot);
    const alias = row.alias ?? "";
    if ((alias === "") === (row.adopt === "")) {
      fail(`差し替え表の${row.song}にadoptとaliasのどちらか一方を書く`);
    }
    return alias === ""
      ? {
        song,
        slot,
        adopt: resolve(row.adopt),
        adoptSlot: Number(row.adopt_slot || 0),
      }
      : { song, slot, alias };
  });
}
