// 難易度の欄の文字と色。1つの欄に、ほかの欄から入る譜面と自前の譜面を、別の譜面として並べる。

import type { ChartPrint } from "@csa/core";
import type { Chart, ChartFrom, SongRow } from "../../types.ts";
import { correctedText } from "./text.ts";

/** 難易度の欄に入る譜面1つ */
export interface ChartPart {
  /** 欄に譜面が2つあるときに、譜面ごとに付ける色と区切り */
  classes: string;
  /** 表エントリーの版の譜面と比べた結果。比べていない譜面は持たない */
  compare?: string;
  /** 譜面の出どころ。`text`は欄に出す文字、`title`はマウスオーバー時に表示される説明文 */
  from?: { text: string; title: string };
  /** レベル。補正で変わったなら`補正前→補正後` */
  level: string;
  notes: number;
  /** 外した譜面と同じ譜面が同じ行にあれば、その難易度 */
  sameAs?: string;
  /** 別の版の別の難易度で同じ譜面。`title`は、すべての譜面を並べた説明文 */
  sameIn?: { text: string; title: string };
}

/**
 * 難易度の欄。テンプレートの`each`は null の要素を空のオブジェクトとして扱うので、
 * 譜面が無い欄も null にせず、`none`で示す
 */
export interface ChartView {
  /** 欄に譜面が1つのときに、欄に付ける色 */
  classes?: string;
  /** 譜面が無い */
  none?: true;
  /** ほかの欄から入る譜面を先に、自前の譜面を後に並べる */
  parts?: ChartPart[];
}

type LabelOf = (name: string) => string;

/** 外した譜面は黒に、ほかの欄へ移した譜面は薄い文字にする。`dark`は黒くする区分 */
const colorsOf = ({ excluded, linked }: Chart, dark: string): string[] => [
  ...(excluded ? [dark] : []),
  ...(linked ? ["text-body-tertiary"] : []),
];

/**
 * 難易度`name`の欄。`labelOf`は、難易度名から、表の列見出しに使う略号を引く。
 * ほかの欄から入る譜面は、移し先の難易度で比べた結果を出す
 */
export function chartView(
  { charts, movedIn }: Pick<SongRow, "charts" | "movedIn">,
  name: string,
  labelOf: LabelOf = (name) => name,
): ChartView {
  const incoming = movedIn?.[name];
  const own = charts[name];
  const parts = [
    ...(incoming === undefined ? [] : [{
      chart: incoming,
      compare: compareText(incoming.print?.moved?.[name]),
      from: fromView(incoming.from, labelOf),
      sameAs: undefined,
    }]),
    ...(own === undefined ? [] : [{
      chart: own,
      compare: compareText(own.print?.compare),
      from: undefined,
      sameAs: sameAsOf(charts, name, labelOf),
    }]),
  ];
  if (parts.length === 0) {
    return { none: true };
  }
  const single = parts.length === 1;
  return {
    ...(single
      ? { classes: colorsOf(parts[0].chart, "table-dark").join(" ") }
      : {}),
    parts: parts.map(({ chart, compare, from, sameAs }, index) => {
      const sameIn = sameInView(chart.print?.sameIn, labelOf);
      return {
        classes: single ? "" : [
          ...colorsOf(chart, "text-bg-dark"),
          ...(index === 0 ? [] : ["border-top"]),
        ].join(" "),
        ...(compare === undefined ? {} : { compare }),
        ...(from === undefined ? {} : { from }),
        level: chart.before === undefined
          ? String(chart.level)
          : correctedText(String(chart.before), String(chart.level)),
        notes: chart.notes,
        ...(sameAs === undefined ? {} : { sameAs }),
        ...(sameIn === undefined ? {} : { sameIn }),
      };
    }),
  };
}

/** 表にする版を選ぶ順で先頭の譜面を書き、残りは数だけを書く */
function sameInView(
  sameIn: ChartPrint["sameIn"],
  labelOf: LabelOf,
): ChartPart["sameIn"] {
  if (sameIn === undefined || sameIn.length === 0) {
    return undefined;
  }
  const charts = sameIn.map((chart) => {
    const [id, name] = chart.split("/");
    return { id, label: labelOf(name) };
  });
  const [first] = charts;
  const head = `${first.id.split(":")[0]} ${first.label}`;
  const rest = charts.length - 1;
  return {
    text: rest === 0 ? `${head}と同一` : `${head}ほか${rest}譜面と同一`,
    title: charts.map(({ id, label }) => `${id} ${label}`).join("、"),
  };
}

/** 同じ曲の中で移した譜面は、難易度だけを書く */
function fromView(
  { chart, generation }: ChartFrom,
  labelOf: LabelOf,
): NonNullable<ChartPart["from"]> {
  const source = generation === undefined
    ? labelOf(chart)
    : `${generation} ${labelOf(chart)}`;
  return { text: `🔗 ${source}`, title: `${source} の譜面を演奏する` };
}

/**
 * 表エントリーの版の譜面と比べた結果の文字。比べていない譜面は`undefined`。
 * 一致割合は切り捨てる。こうすると、100% と出るのは完全に一致した譜面に限られる
 */
export function compareText(
  compare: ChartPrint["compare"],
): string | undefined {
  const result = compare?.result;
  if (result === undefined) {
    return undefined;
  }
  if (result === "layout") {
    return "配置不一致";
  }
  if (result === "bpm") {
    return "BPM不一致";
  }
  return `${Math.floor(result * 1000) / 10}%`;
}

/** 外した譜面と同じ譜面を、同じ行で収録する難易度。相手も外した譜面なら書かない */
function sameAsOf(
  charts: SongRow["charts"],
  name: string,
  labelOf: LabelOf,
): string | undefined {
  const chart = charts[name];
  const all = chart?.print?.all;
  if (!chart?.excluded || all === undefined) {
    return undefined;
  }
  const same = Object.entries(charts).find(([other, each]) =>
    other !== name && !each.excluded && each.print?.all === all
  );
  return same === undefined ? undefined : `${labelOf(same[0])}と同一`;
}
