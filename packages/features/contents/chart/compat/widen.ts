import { SOUND_COMMANDS } from "../fix/mod.ts";
import type { Chart } from "../format/mod.ts";

export const carriesSoundId = (c1: number) => SOUND_COMMANDS.has(c1 & 0x0f);

/** F1/F2は1バイトのフィールドしか無いので、sound_idを運ぶコマンドだけc2からparamへ移す */
export function toF3(chart: Chart): Chart {
  if (chart.format === "F3") {
    return chart;
  }
  const events = chart.events.map((event) =>
    carriesSoundId(event.c1)
      ? { tick: event.tick, c1: event.c1, c2: 0, param: event.c2 }
      : event
  );
  return { ...chart, format: "F3", events };
}

/** 実時間(tick × multiplier)が保たれるよう、tickを四捨五入で再スケールする */
export function rescaleMultiplier(chart: Chart, multiplier: number): Chart {
  if (chart.multiplier === multiplier) {
    return chart;
  }
  const events = chart.events.map((event) => ({
    ...event,
    tick: Math.round(event.tick * chart.multiplier / multiplier),
  }));
  return { ...chart, multiplier, events };
}
