// 実行中の工程の下に出す、今の作業の行を組み立てる。
// 周回の処理は工程の区切りと途中経過をログへ書くので、そこから読み取る。

/** `console.time`のラベル → 作業名。工程の中で動く順に並べる */
const ACTIVITIES: readonly (readonly [RegExp, string])[] = [
  [/ charts$/, "Reading charts"],
  [/overlay prints$/, "Checking overlays"],
  [/era1 movie formats$/, "Checking movies"],
  [/era1 movie conversion$/, "Converting movies"],
  [/table rows$/, "Reading song table"],
  [/video export$/, "Copying videos"],
  [/sound bundle$/, "Building sound bank"],
  [/sound and overlay (lengths|hashes)$/, "Checking sounds"],
  [
    /(title cards|overlays|image sets|title cards and overlays)$/,
    "Building title cards",
  ],
  [/song rows and manifest$/, "Selecting songs"],
  [/ISO plan$/, "Planning ISO"],
  [/ISO write$/, "Writing ISO"],
  [/ISO verify$/, "Verifying ISO"],
];

const ERA1_ONLY = ["Checking movies", "Converting movies"];
const PB_STEPS = ["Reading charts", "Checking overlays"];
const ISO_ACTIVITIES = [
  "Selecting songs",
  "Planning ISO",
  "Writing ISO",
  "Verifying ISO",
];

/**
 * 周回の作業の並び。ムービーの作業は era1 の世代にだけある。
 * PBの周回は、譜面とPBのオーバーレイだけを読む
 */
export function lapSteps({ era1, pb }: { era1: boolean; pb: boolean }) {
  if (pb) {
    return PB_STEPS;
  }
  return ACTIVITIES.map(([, name]) => name)
    .filter((name) => !ISO_ACTIVITIES.includes(name))
    .filter((name) => name !== "Checking overlays")
    .filter((name) => era1 || !ERA1_ONLY.includes(name));
}

/** ISOの工程の作業の並び。照合は`--verify`のときだけ行う */
export const isoSteps = (verify: boolean): string[] =>
  ISO_ACTIVITIES.filter((name) => verify || name !== "Verifying ISO");

const COUNT = /^(\d+\/\d+) /;
const WRITTEN = /written ([\d.]+ GB)/;

export class Activity {
  #name = "";
  #count = "";
  #written = "";
  readonly #steps: readonly string[];

  /** `steps`は、工程の作業の並び */
  constructor(steps: readonly string[] = []) {
    this.#steps = steps;
  }

  /** `console.time`のラベルから、今の作業を決める */
  timer(label: string): void {
    const found = ACTIVITIES.find(([pattern]) => pattern.test(label));
    if (found !== undefined) {
      this.#name = found[1];
      this.#count = "";
    }
  }

  /** ログの行から、件数と書き込んだ量を読む */
  logLine(line: string): void {
    this.#count = line.match(COUNT)?.[1] ?? this.#count;
    this.#written = line.match(WRITTEN)?.[1] ?? this.#written;
  }

  get line(): string {
    const at = this.#steps.indexOf(this.#name);
    const step = at < 0 ? "" : `[${at + 1}/${this.#steps.length}] `;
    const name = this.#count === ""
      ? this.#name
      : `${this.#name} (${this.#count})`;
    const amount = this.#written === "" ? "" : `${this.#written} written`;
    return [step + name, amount].filter((part) => part !== "").join(" · ");
  }
}
