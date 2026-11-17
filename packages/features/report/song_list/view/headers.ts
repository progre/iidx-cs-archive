// 曲・譜面の表の見出し。難易度の列は曲リストのデータから決まるので、ここには置かない。

/**
 * 見出しの1行めのまとまりと、その下に並ぶ2行めの列名。
 * 列名の1要素が1行で、値より長い列名は改行して幅を抑える
 */
export interface HeaderGroup {
  columns: string[][];
  label: string;
}

const SIZE = ["容量"];

/**
 * 見出しの「曲」のまとまり。管理名・曲名とメモの列は、このまとまりに入れない。
 * 管理名・曲名は表の左端に、メモは右端に置く
 */
export const SONG_GROUP: HeaderGroup = {
  columns: [
    ["原作", "原フ", "収フ"],
    ["裏エントリー"],
  ],
  label: "曲",
};

/** 音のハッシュの欄の並び。音の種類と、本体・ヘッダーのどちらのハッシュか */
export const SOUND_PRINT_COLUMNS = [
  ["bgm", "body"],
  ["bgm", "header"],
  ["keysound", "body"],
  ["keysound", "header"],
] as const;

const SOUND_LABELS = {
  bgm: "BGM",
  body: "本体",
  header: "ヘッダー",
  keysound: "キー音",
};

/** 音のハッシュの欄は、ファイルごとに1行を並べる */
export const ASSET_GROUPS: HeaderGroup[] = [
  {
    columns: [
      SIZE,
      ...SOUND_PRINT_COLUMNS.map((pair) => pair.map((k) => SOUND_LABELS[k])),
    ],
    label: "音",
  },
  { columns: [SIZE, ["識別子"]], label: "ムービー" },
  { columns: [SIZE, ["枚数"], ["識別子"]], label: "オーバーレイ" },
];
