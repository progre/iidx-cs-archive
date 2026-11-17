// 工程の一覧を描いている間は、ログを画面ではなくファイルへ書く。

import { Console } from "node:console";
import { createWriteStream } from "node:fs";

export interface LogObserver {
  timer(label: string): void;
  logLine(line: string): void;
}

/** ログの内容は`observer`にも渡す。周回の処理の進み具合は、ログからしか分からない */
export function redirectConsoleTo(path: string, observer: LogObserver): void {
  const stream = createWriteStream(path);
  const file = new Console(stream, stream);
  const time = file.time.bind(file);
  const log = file.log.bind(file);
  file.time = (label?: string) => {
    observer.timer(label ?? "");
    time(label);
  };
  file.log = (...data: unknown[]) => {
    observer.logLine(String(data[0]));
    log(...data);
  };
  globalThis.console = file as unknown as typeof console;
}
