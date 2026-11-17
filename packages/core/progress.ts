/** 件数の経過をログへ書くかを決める。1%進んだときと、最後の1件のときに真になる */
export const isProgressStep = (done: number, total: number): boolean =>
  done === total ||
  Math.floor(done * 100 / total) !== Math.floor((done - 1) * 100 / total);
