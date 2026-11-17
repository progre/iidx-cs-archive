// 譜面アーカイブのLZ圧縮。`if_container`の4KBリングLZSSとは別の方式で、
// 制御バイト(下位ビットから先に使う)にリテラル/参照の別を持つ。

/** 終端トークン(制御ビット1・データ0xFF) */
const END_TOKEN = 0xff;

/**
 * 参照の範囲。展開側(`decodeLz`)が読める形に合わせる。
 * - 短い参照: 1バイト。距離1〜16、写す長さ2〜5
 * - 長い参照: 2バイト。距離1〜1023、写す長さ3〜34
 */
const SHORT_MAX_DISTANCE = 16;
const SHORT_MAX_COUNT = 5;
const LONG_MAX_DISTANCE = 1023;
const LONG_MAX_COUNT = 34;
const MIN_COUNT = 2;

/** 同じ3バイトの候補を何件まで辿るか。長すぎる探索を避ける */
const CHAIN_LIMIT = 64;
const HASH_SIZE = 1 << 16;

interface Match {
  count: number;
  distance: number;
}

const hashAt = (data: Uint8Array, at: number): number =>
  ((data[at] << 8) ^ (data[at + 1] << 4) ^ data[at + 2]) & (HASH_SIZE - 1);

function matchLength(
  data: Uint8Array,
  candidate: number,
  at: number,
  limit: number,
): number {
  let count = 0;
  while (count < limit && data[candidate + count] === data[at + count]) {
    count++;
  }
  return count;
}

/** `at`から始まる繰り返しのうち、最も長いもの。近いものを先に見る */
function findMatch(
  data: Uint8Array,
  at: number,
  head: Int32Array,
  previous: Int32Array,
): Match | undefined {
  const limit = Math.min(LONG_MAX_COUNT, data.length - at);
  if (limit < MIN_COUNT) {
    return undefined;
  }
  let best: Match | undefined;
  if (limit >= 3) {
    let candidate = head[hashAt(data, at)];
    for (
      let steps = 0;
      candidate >= 0 && at - candidate <= LONG_MAX_DISTANCE &&
      steps < CHAIN_LIMIT;
      steps++, candidate = previous[candidate]
    ) {
      const count = matchLength(data, candidate, at, limit);
      if (count >= 3 && count > (best?.count ?? 0)) {
        best = { count, distance: at - candidate };
      }
    }
  }
  if (best === undefined) {
    // 2バイトの繰り返しは、短い参照でだけ表せる
    for (
      let distance = 1;
      distance <= Math.min(SHORT_MAX_DISTANCE, at);
      distance++
    ) {
      const count = matchLength(
        data,
        at - distance,
        at,
        Math.min(limit, SHORT_MAX_COUNT),
      );
      if (count >= MIN_COUNT && count > (best?.count ?? 0)) {
        best = { count, distance };
      }
    }
  }
  return best;
}

/**
 * 繰り返しを参照で表す符号化。8トークンごとに制御バイトを置き、末尾に終端トークンを1個足す。
 * 後段のCBC-CTSは、長さが8の倍数でない入力を要する。
 * そこで、出力長が8の倍数になるときは、末尾に1バイトを足す。復号は終端トークンで止まるので、この1バイトは読まれない。
 * 繰り返しは、その位置で最長のものを先に取る貪欲法で探す。リテラル列のトークンは使わない。
 */
export function encodeLz(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let controlAt = 0;
  let used = 8;
  const token = (reference: boolean, ...bytes: number[]) => {
    if (used === 8) {
      controlAt = out.length;
      out.push(0);
      used = 0;
    }
    if (reference) {
      out[controlAt] |= 1 << used;
    }
    used++;
    out.push(...bytes);
  };
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const previous = new Int32Array(data.length).fill(-1);
  const register = (at: number) => {
    if (at + 2 >= data.length) {
      return;
    }
    const hash = hashAt(data, at);
    previous[at] = head[hash];
    head[hash] = at;
  };
  for (let at = 0; at < data.length;) {
    const match = findMatch(data, at, head, previous);
    if (match === undefined) {
      token(false, data[at]);
      register(at++);
      continue;
    }
    const { count, distance } = match;
    if (distance <= SHORT_MAX_DISTANCE && count <= SHORT_MAX_COUNT) {
      token(true, ((count + 6) << 4) | (distance - 1));
    } else {
      token(
        true,
        ((count - 3) << 2) | (distance >> 8),
        distance & 0xff,
      );
    }
    const end = at + count;
    for (; at < end; at++) {
      register(at);
    }
  }
  token(true, END_TOKEN);
  if (out.length % 8 === 0) {
    out.push(0);
  }
  return Uint8Array.from(out);
}

/**
 * `encodeLz`の読み戻し用。参照(距離・長さ)とリテラル列も復号する。
 * 参考: https://github.com/SaxxonPike/iidx-ps2tools の`common.py`の`decode_lz`
 */
export function decodeLz(input: Uint8Array): Uint8Array {
  const output: number[] = [];
  let at = 0;
  let control = 0;
  for (;;) {
    control >>= 1;
    if ((control & 0x100) === 0) {
      control = input[at++] | 0xff00;
    }
    const data = input[at++];
    if ((control & 1) === 0) {
      output.push(data);
      continue;
    }
    if (data === END_TOKEN) {
      return Uint8Array.from(output);
    }
    if ((data & 0x80) === 0) {
      copyBack(output, ((data & 3) << 8) | input[at++], (data >> 2) + 2);
    } else if ((data & 0x40) === 0) {
      copyBack(output, (data & 0x0f) + 1, (data >> 4) - 7);
    } else {
      const count = data - 0xb9 + 1;
      output.push(...input.subarray(at, at + count));
      at += count;
    }
  }
}

/** 距離だけ前から長さ+1バイトを写す。重なる参照は1バイトずつ写す */
function copyBack(output: number[], distance: number, length: number): void {
  const start = output.length - distance;
  for (let i = 0; i <= length; i++) {
    output.push(output[start + i]);
  }
}
