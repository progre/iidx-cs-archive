// ビルドの進み具合を表示する interface と、工程の一覧を描かない実装。

export interface BuildProgress {
  /** 工程を実行する。`names`の順に呼ぶ */
  stage<T>(name: string, run: () => Promise<T>): Promise<T>;
  /** 全工程の後で呼ぶ */
  finish(): Promise<void>;
}

/** 開発者向けの`--images`で使う。ログをそのまま流す */
export const plainProgress: BuildProgress = {
  stage: (_name, run) => run(),
  finish: () => Promise.resolve(),
};
