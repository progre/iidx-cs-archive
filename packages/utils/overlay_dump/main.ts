// `.if`のanimationをframeごとにPNGへ描く。原盤の曲中オーバーレイの中身を目で確かめる。
//
// 実行: deno run --allow-read=. --allow-write=build/overlay_dump \
//   packages/utils/overlay_dump/main.ts \
//   --out build/overlay_dump/<名前> [--step 10] [--anim <n>] <file.if>
//
// 出力は sheet<i>.png と anim<n>_f<frame>.png、metadataの要約は標準出力。

import { parseArgs } from "@std/cli/parse-args";
import { Buffer } from "node:buffer";
import { Jimp } from "jimp";
import {
  decodeTexture8,
  parseAnimations,
  parseIfPackage,
} from "@csa/containers-if-container";
import { Renderer } from "./render.ts";

const args = parseArgs(Deno.args, {
  default: { step: 10 },
  string: ["anim", "out"],
});
const [input] = args._;
if (typeof input !== "string" || args.out === undefined) {
  throw new Error("--out <dir> と .if のパスを指定する");
}
const step = Number(args.step);
const only = args.anim === undefined ? undefined : Number(args.anim);

const pkg = parseIfPackage(Deno.readFileSync(input));
const animations = parseAnimations(pkg.files[0]);
Deno.mkdirSync(args.out, { recursive: true });

for (const [i, sheet] of pkg.metadata.sheets.entries()) {
  const image = Jimp.fromBitmap({
    data: Buffer.from(
      decodeTexture8(pkg.files[i + 1], sheet.width, sheet.height),
    ),
    height: sheet.height,
    width: sheet.width,
  });
  await image.write(`${args.out}/sheet${i}.png`);
}
console.log(
  `sheets=${pkg.metadata.sheets.length} sprites=${pkg.metadata.sprites.length} ` +
    `animations=${animations.length}`,
);

const renderer = new Renderer(pkg, animations);
for (const [n, animation] of animations.entries()) {
  if (only !== undefined && n !== only) continue;
  const kinds = animation.items.map((item) => item.kind).join("");
  console.log(
    `anim${n} ${animation.width}x${animation.height} ` +
      `f${animation.startFrame}-${animation.endFrame} items=${animation.items.length} kinds=${kinds}`,
  );
  for (let f = animation.startFrame; f < animation.endFrame; f += step) {
    const frame = renderer.render(n, f);
    await frame.write(
      `${args.out}/anim${n}_f${String(f).padStart(4, "0")}.png`,
    );
  }
}
