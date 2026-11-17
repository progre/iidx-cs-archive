import { assertEquals } from "@std/assert";
import {
  cropFilter,
  findProblems,
  metaTextOf,
  outputPathOf,
  reportLineOf,
} from "./conversion.ts";
import type { Era1Job } from "./types.ts";

const job: Era1Job = {
  band: { h: 218, w: 320, x: 0, y: 2 },
  crop: { h: 218, w: 218, x: 51, y: 2 },
  songIds: [3, 4],
  video: {
    archive: "A.BIN",
    generation: "6th",
    index: 5,
    key: "A_0005",
    offset: 100,
    partner: null,
    size: 200,
    slot: 0,
    songCount: 2,
    title: "T",
  },
};

const sound = {
  height: 240,
  packSizes: [16384],
  pictures: 10,
  sourcePictures: 10,
  systemHeaders: 1,
  trailing: 0,
  width: 240,
};

Deno.test("cropFilter: 切り出しと240x240への拡大を指定する", () => {
  assertEquals(
    cropFilter(job.crop),
    "crop=218:218:51:2,scale=240:240:flags=lanczos,setsar=1",
  );
});

Deno.test("findProblems: 問題が無ければ空を返す", () => {
  assertEquals(findProblems(sound), []);
});

Deno.test("findProblems: 4種の問題を順に報告する", () => {
  const problems = findProblems({
    height: 224,
    packSizes: [16384, 2048],
    pictures: 9,
    sourcePictures: 10,
    systemHeaders: 2,
    trailing: 0,
    width: 240,
  });
  assertEquals(problems, [
    "pictures 9 != source 10",
    "pack length is not 16KB",
    "invalid end code or system header",
    "resolution 240x224",
  ]);
});

Deno.test("outputPathOf: 作品とkeyでPSSの置き場を決める", () => {
  assertEquals(
    outputPathOf("out", job),
    "out/6th/video_converted/A_0005.pss",
  );
});

Deno.test("metaTextOf: キーの順を固定したJSONを1行で返す", () => {
  const text = metaTextOf(job, { pictures: 10, problems: [], size: 99 });
  assertEquals(
    text,
    '{"band":{"h":218,"w":320,"x":0,"y":2},"crop":{"h":218,"w":218,"x":51,"y":2},' +
      '"pictures":10,"problems":[],"size":99,"songIds":[3,4],' +
      '"source":{"archive":"A.BIN","index":5,"offset":100,"size":200},"title":"T"}\n',
  );
});

Deno.test("reportLineOf: 問題があれば末尾に付ける", () => {
  assertEquals(
    reportLineOf(job, { pictures: 10, problems: [], size: 99 }),
    "6th A_0005 T: 10 pictures 99B",
  );
  assertEquals(
    reportLineOf(job, { pictures: 10, problems: ["a", "b"], size: 99 }),
    "6th A_0005 T: 10 pictures 99B problems: a, b",
  );
});
