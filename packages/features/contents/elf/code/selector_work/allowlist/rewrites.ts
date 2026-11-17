import {
  type HighAlias,
  type HighSplit,
  type RewriteBatch,
  type RewriteCoupling,
  unpackRewriteGroups,
} from "./types.ts";

const REWRITE_BATCHES: readonly RewriteBatch[] = [
  ["カテゴリー集計", "recordStrideShift", "shift", 9],
  ["派生レコード再構築", "recordStrideShift", "shift", 1],
  ["フォルダー行の終端レコード複写", "recordStrideShift", "shift", 7],
  ["登録件数の取得", "recordStrideShift", "shift", 8],
  ["表示状態の取得", "recordStrideShift", "shift", 10],
  ["グループ別の派生レコード追記", "recordStrideShift", "shift", 4],
  ["グループ別の派生レコード追記", "fourSongsStrideShift", "shift", 1],
  ["レコード並べ替え", "fourSongsStrideShift", "shift", 1],
  ["cache A・二次表Aの処理", "fourSongsStrideShift", "shiftSourceEarly", 1],
  ["states・cache Aの処理", "fourSongsStrideShift", "shift", 1],
  ["カテゴリー集計", "fourSongsStrideMultiply", "multiplyEarly", 1],
  ["レコード並べ替え", "fourSongsStrideMultiply", "multiplyEarly", 2],
  ["レコード並べ替え", "fourSongsStrideMultiply", "multiplyCoupledFirst", 1],
  ["レコード並べ替え", "fourSongsStrideMultiply", "multiplyCoupledSecond", 1],
  ["レコード並べ替え", "fourSongsStrideMultiply", "multiplyDeferred", 1],
  [
    "レコードとint表の連動並べ替え",
    "fourSongsStrideMultiply",
    "multiplyEarly",
    1,
  ],
  [
    "レコードとint表の連動並べ替え",
    "fourSongsStrideMultiply",
    "multiplyCoupledFirst",
    1,
  ],
  [
    "レコードとint表の連動並べ替え",
    "fourSongsStrideMultiply",
    "multiplyCoupledSecond",
    1,
  ],
  ["カテゴリー集計", "twentySongsStrideMultiply", "multiplyEarly", 1],
  ["cache A・二次表Aの処理", "twentySongsStrideMultiply", "multiplyEarly", 1],
];

const REWRITE_ROWS = [
  "0020d2f0,0020d2f8,0020d2fc,0020d300,0020d304",
  "0020d338,0020d340,0020d344,0020d348,0020d34c",
  "0020d388,0020d390,0020d394,0020d398,0020d39c",
  "0020d3cc,0020d3d4,0020d3d8,0020d3dc,0020d3e0",
  "0020d41c,0020d424,0020d428,0020d42c,0020d430",
  "0020d478,0020d480,0020d488,0020d48c,0020d490",
  "0020d4a8,0020d4b0,0020d4b8,0020d4bc,0020d4c0",
  "0020d4d8,0020d4e0,0020d4e8,0020d4ec,0020d4f0",
  "0020d52c,0020d534,0020d538,0020d53c,0020d540",
  "0020dc00,0020dc04,0020dc0c,0020dc14,0020dc1c",
  "0020de04,0020de0c,0020de14,0020de1c,0020de24",
  "0020df00,0020df08,0020df10,0020df14,0020df18",
  "0020df50,0020df58,0020df60,0020df68,0020df70",
  "0020e028,0020e030,0020e038,0020e040,0020e048",
  "0020e14c,0020e15c,0020e164,0020e16c,0020e174",
  "0020e858,0020e860,0020e868,0020e86c,0020e870",
  "0020eb74,0020eb7c,0020eb80,0020eb88,0020eb90",
  "0020eea4,0020eea8,0020eeac,0020eeb0,0020eeb4",
  "0020eeec,0020eef4,0020eef8,0020ef00,0020ef04",
  "0020ef38,0020ef3c,0020ef40,0020ef44,0020ef48",
  "0020ef88,0020ef8c,0020ef90,0020ef94,0020ef98",
  "0020f010,0020f018,0020f01c,0020f020,0020f024",
  "0020f060,0020f068,0020f06c,0020f074,0020f078",
  "0020f0a0,0020f0ac,0020f0b0,0020f0b4,0020f0b8",
  "0020f0d4,0020f0dc,0020f0e0,0020f0e4,0020f0e8",
  "0020f1a4,0020f1ac,0020f1b0,0020f1b4,0020f1b8",
  "0020f208,0020f20c,0020f210,0020f214,0020f218",
  "0020f264,0020f26c,0020f278,0020f280,0020f284",
  "0020f2e0,0020f2e4,0020f2e8,0020f2ec,0020f2f0",
  "0020f368,0020f36c,0020f370,0020f374,0020f378",
  "0020f3c4,0020f3c8,0020f3cc,0020f3d0,0020f3d4",
  "0020f454,0020f45c,0020f460,0020f464,0020f468",
  "0020f4a8,0020f4b0,0020f4b4,0020f4b8,0020f4bc",
  "0020f4fc,0020f504,0020f508,0020f50c,0020f510",
  "0020f560,0020f568,0020f574,0020f57c,0020f580",
  "0020faf8,0020fb00,0020fb04,0020fb08,0020fb0c",
  "0020fbe8,0020fbf0,0020fbf8,0020fc00,0020fc08",
  "0020ff20,0020ff28,0020ff30,0020ff38,0020ff40",
  "002108f4,002108f8,002108fc,00210900,00210904",
  "002100c0,002100c8,002100d0,002100d8,002100e0",
  "002118e0,002118e4,002118ec,002118f4,002118fc",
  "002132f8,00213300,00213308,00213310,00213318",
  "002133d8,002133e0,002133e8,002133f0,002133f4",
  "0020d700,0020d704,0020d70c,0020d710,0020d714",
  "00211ad0,00211ad4,00211ae0,00211ae4,00211ae8",
  "00211c20,00211c24,00211c28,00211c2c,00211c30",
  "002120b4,002120b8,002120c4,002120d4,002120e0",
  "002120c0,002120c8,002120d0,002120d8,002120e4",
  "00212260,00212264,00212268,00212270,00212278",
  "0021271c,00212720,00212724,0021272c,00212730",
  "00212ea0,00212ea8,00212eb0,00212eb8,00212ec4",
  "00212eac,00212eb4,00212ebc,00212ec0,00212ec8",
  "0020d64c,0020d650,0020d654,0020d658,0020d65c",
  "00213330,00213338,0021333c,00213340,00213344",
] as const;

export const REWRITE_GROUPS = unpackRewriteGroups(
  REWRITE_BATCHES,
  REWRITE_ROWS,
);

export const MULTIPLY_COUPLINGS: readonly RewriteCoupling[] = [
  [0x2120b4, 0x2120c0],
  [0x212ea0, 0x212eac],
];

export const FOUR_SONG_INCREMENTS: readonly number[] = [
  0x210af0,
  0x210af4,
  0x210af8,
  0x210b08,
];

export const HIGH_SPLITS: readonly HighSplit[] = [
  ["更新callback", 0x20d214, 0x20d218, 0x20d228],
  ["選曲ワークの初期化", 0x20dd28, 0x20dd2c, 0x20dd40],
];

// `0x20ea94`はフォルダー構築の末尾で作業recordの件数を読む。`lui`は2つあり、
// `0x20dec0`の分岐が遅延スロットの`0x20dec4`を使うのに対し、
// 他41本の分岐が集まるフォールスルー経路は`0x20ea84`を使う。
export const HIGH_ALIASES: readonly HighAlias[] = [
  ["フォルダー行の終端レコード複写", 0x20ea94, 0x20ea84],
];
