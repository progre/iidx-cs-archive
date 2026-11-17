// 指定の世代の原盤がドライブに入るまで待つ。

import { Iso9660 } from "../../volume/mod.ts";
import type { OpenedDisc } from "../generation_disc.ts";
import { type SectorDevice, SectorDiscImage } from "./sector_image.ts";

export interface WaitDisplay {
  /** 利用者の操作が新しく要るようになったことを、音で知らせる */
  alert: () => void;
  /** 利用者がする操作を示す */
  prompt: (line: string) => void;
  /** 待ち終えて読み始めることを知らせる */
  reading: () => void;
}

export interface WaitPorts extends WaitDisplay {
  drive: string;
  openDevice: () => Promise<SectorDevice>;
  sleep: () => Promise<void>;
}

export interface ExpectedDisc {
  /** 利用者へ示すゲーム名 */
  title: string;
  /** 世代を見分ける名前。原盤のルートのELFの名前は世代ごとに異なり、ボリュームIDは全世代で空である */
  elfName: string;
}

/** 読めない間はドライブの準備中か空かなので待つ。権限の不足は待っても直らないので投げる */
function isFatal(error: unknown): boolean {
  return error instanceof Deno.errors.NotCapable ||
    error instanceof Deno.errors.PermissionDenied;
}

async function tryOpen(ports: WaitPorts): Promise<OpenedDisc | string> {
  let device: SectorDevice | null = null;
  try {
    device = await ports.openDevice();
    const disc = new Iso9660(await SectorDiscImage.open(device));
    return { disc, files: await disc.collectFiles() };
  } catch (error) {
    device?.close();
    if (isFatal(error)) {
      throw error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

/** ディスクの番号は、ELFの名前の`SLPM_650.06`がラベルの`SLPM-65006`に対応する */
const labelOf = ({ title, elfName }: ExpectedDisc) =>
  `"${title}" (${elfName.toUpperCase().replace("_", "-").replace(".", "")})`;

/**
 * 正しいディスクがすでに入っていれば、何も促さずに読み始める。
 * `previous`は直前に読み終えたディスクである。入ったままなのは正常な流れなので、誤りとして扱わない。
 * 音は、待ち始めたときと、間違ったディスクが入ったときだけ鳴らす。間違ったディスクを抜いたときは鳴らさない
 */
export async function waitForDisc(
  expected: ExpectedDisc,
  previous: ExpectedDisc | null,
  ports: WaitPorts,
): Promise<OpenedDisc> {
  const wanted = expected.elfName.toUpperCase();
  const disc = labelOf(expected);
  const finishedElf = previous?.elfName.toUpperCase();
  const insert = `Insert ${disc} into drive ${ports.drive}`;
  const wrong = `This is not the right disc. ${insert}`;
  let lastPrompt: string | null = null;
  let lastFailure: string | null = null;
  const promptOnChange = (line: string) => {
    if (line === lastPrompt) {
      return;
    }
    if (lastPrompt === null || line === wrong) {
      ports.alert();
    }
    ports.prompt(line);
    lastPrompt = line;
  };
  while (true) {
    const opened = await tryOpen(ports);
    if (typeof opened === "string") {
      // 空のドライブでは毎回同じ失敗になるので、変わったときだけ記録する
      if (opened !== lastFailure) {
        console.log(`disc not readable: ${opened}`);
      }
      lastFailure = opened;
      promptOnChange(insert);
    } else if (opened.files.has(wanted)) {
      ports.reading();
      return opened;
    } else {
      opened.disc.close();
      promptOnChange(
        previous !== null && opened.files.has(finishedElf!) ? insert : wrong,
      );
    }
    await ports.sleep();
  }
}
