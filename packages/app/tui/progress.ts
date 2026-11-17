// ビルドの進み具合の表示。工程の一覧の描画は listr2 に任せる。

import {
  Listr,
  ListrDefaultRendererLogLevels,
  type ListrRendererValue,
  ListrTaskState,
  parseTimer,
  PRESET_TIMER,
} from "listr2";
import { Activity } from "./activity.ts";
import type { BuildProgress } from "./plain_progress.ts";

const WAITING_ICON = "\u{1F4C0}";

interface StageTask {
  title: string;
  output: string;
  task: { state$: ListrTaskState };
}

/** listr2 の工程と、`stage`で実行する処理を、開始と終了の Promise でつなぐ */
class Stage {
  readonly started = Promise.withResolvers<StageTask>();
  readonly done = Promise.withResolvers<void>();
}

/** 利用者の操作を待つ間を、処理している間と区別して表示する */
export interface DiscProgress extends BuildProgress {
  /** 実行中の工程を、利用者の操作を待つ表示にする */
  wait(line: string): void;
  /** 待つ表示をやめる。経過時間はここから数え直す */
  resume(): void;
  /** 今の作業を決める`console.time`のラベルを受け取る */
  timer(label: string): void;
  /** 件数と書き込んだ量を含むログの行を受け取る */
  logLine(line: string): void;
}

/** `stepsOf`は、工程の作業の並びを返す。今の作業が何番目かを示すのに使う */
export function listrProgress(
  names: readonly string[],
  titleOf: (name: string) => string,
  stepsOf: (name: string) => readonly string[],
  renderer: ListrRendererValue = "default",
): DiscProgress {
  const stages = new Map(names.map((name) => [name, new Stage()]));
  let current: { task: StageTask; title: string; startedAt: number } | null =
    null;
  let activity = new Activity();
  const showActivity = () => {
    if (current !== null) {
      current.task.output = activity.line;
    }
  };
  const listr = new Listr(
    names.map((name) => ({
      title: titleOf(name),
      task: (_: unknown, task: StageTask) => {
        const stage = stages.get(name)!;
        stage.started.resolve(task);
        return stage.done.promise;
      },
    })),
    {
      renderer,
      rendererOptions: {
        icon: { [ListrDefaultRendererLogLevels.PAUSED]: WAITING_ICON },
        // 既定では、`PAUSED`のタイトルの後ろに`undefined`と出る
        pausedTimer: { ...PRESET_TIMER, condition: () => false },
      },
    },
  );
  const finished = listr.run();
  // 描画の失敗などで止まると工程は始まらないので、開始を待つ側へも投げる
  const stopped = new Promise<never>((_, reject) => {
    finished.catch(reject);
  });
  // 工程の失敗は`stage`の呼び出し側へ投げる。ここでは unhandled rejection だけを防ぐ
  stopped.catch(() => {});
  return {
    stage: async (name, run) => {
      const stage = stages.get(name);
      if (stage === undefined) {
        throw new Error(`未登録の工程: ${name}`);
      }
      const task = await Promise.race([stage.started.promise, stopped]);
      const running = {
        task,
        title: titleOf(name),
        startedAt: performance.now(),
      };
      current = running;
      activity = new Activity(stepsOf(name));
      try {
        const result = await run();
        const elapsed = performance.now() - running.startedAt;
        task.title = `${running.title} [${parseTimer(elapsed)}]`;
        stage.done.resolve();
        return result;
      } catch (error) {
        stage.done.reject(error);
        throw error;
      }
    },
    wait: (line) => {
      if (current !== null) {
        current.task.title = line;
        current.task.task.state$ = ListrTaskState.PAUSED;
      }
    },
    resume: () => {
      if (current !== null) {
        current.task.task.state$ = ListrTaskState.STARTED;
        current.task.title = current.title;
        current.startedAt = performance.now();
      }
    },
    timer: (label) => {
      activity.timer(label);
      showActivity();
    },
    logLine: (line) => {
      activity.logLine(line);
      showActivity();
    },
    finish: async () => {
      await finished;
    },
  };
}
