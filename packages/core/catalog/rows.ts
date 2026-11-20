// 全曲リストの1行の型。読み出しは`selection/song_catalog`が行う。

import type { SwitchRule } from "../plan/mod.ts";

/** 全曲リストの譜面の列名 */
export type Chart =
  | "sb"
  | "sn"
  | "sh"
  | "sa"
  | "sl"
  | "db"
  | "dn"
  | "dh"
  | "da"
  | "dl";

/** 組の中での行の扱い。組は`index_title`(無ければ`title`)が同じ行で作る */
interface CatalogFront {
  /** 表の曲が持たない難易度 → それを出す裏の曲の難易度。どちらも全曲リストの譜面の列名 */
  chartMoves?: Partial<Record<Chart, Chart>>;
  /** 組の5鍵盤版なら`true`。`front_rule`に`five_keys`と書く */
  fiveKeys?: true;
  /** `save_slot_owner`に`*`を書いた行。最も後の作品の行の代わりに、組のセーブの枠の持ち主にする */
  slotOwner?: true;
  /** 原作の組と同じ条件で差し替える裏なら、その条件。書かない裏は、選んで出す裏(`custom`)になる */
  rule?: CatalogRule;
}

/** 選んで出す裏(`custom`)でない、差し替えの条件 */
type CatalogRule =
  | { kind: Exclude<SwitchRule, "custom" | "previousSong"> }
  /** `after`は管理名で、裏の曲と同じ世代の曲を指す。この曲を直前に遊んでいると、裏の曲に切り替わる */
  | { after: string; kind: "previousSong" };

export interface CatalogRow {
  /** ファイルの行番号(1始まり) */
  line: number;
  /** 管理名。`:{song_id}`は含まない */
  name: string;
  /** `:{song_id}`で指した曲。書いていなければnull */
  songId: number | null;
  /** 版をまとめるキーと曲DBの題名は、書いてあればこの曲名から作る。空ならnull */
  indexTitle: string | null;
  /** 譜面が違うため別の曲として並べる版の名前。同じ`index_title`の行を、この値で別の組に分ける。空ならnull */
  edition: string | null;
  /** 選曲画面に出すジャンル名。空ならnull */
  genre: string | null;
  /** 選曲画面に出す曲名。副題は含まない。空ならnull */
  fullTitle: string | null;
  /** 選曲画面に出す副題。空ならnull */
  subtitle: string | null;
  /** 選曲画面に出すアーティスト名。空ならnull */
  artist: string | null;
  /** 曲を入れるバージョン別フォルダーの略号。空ならnullになり、フォルダーは作品番号の規則が決める */
  folder: string | null;
  /**
   * CSAが使うムービーを共通にする組のキー。書いた行だけが持つ。
   * `*`は曲名(索引のキー)が同じ曲どうしの組、それ以外はその文字列が同じ曲どうしの組である
   */
  commonMovie?: string;
  /** 値を書いた譜面だけを持つ */
  levels: Partial<Record<Chart, number>>;
  /** 難易度の列に`x`を書いた、収録しない譜面 */
  excludedCharts: Chart[];
  /** 収録しない曲なら真。`exclude`の列に何か書けば外す */
  exclude: boolean;
  /** 人が書くメモ。空ならnull。曲リストHTMLがメモの列に出す */
  note: string | null;
  /** 組の中での扱い。`save_slot_owner`・`chart_moves`・`front_rule`のどれかを書いた行だけが持つ */
  front?: CatalogFront;
}
