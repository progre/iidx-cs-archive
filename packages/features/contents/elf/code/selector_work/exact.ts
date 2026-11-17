/** 許可一覧の全命令を、指定した選曲ワーク配置に向け直す。 */

import {
  type InstructionPatch,
  InstructionPatchBook,
  type PatchMetadata,
  requireWord,
  type WordSource,
} from "../../elf/mod.ts";
import { withImmediate } from "../mips/mod.ts";
import {
  type DirectGroup,
  FOUR_SONG_INCREMENTS,
  HIGH_ALIASES,
  HIGH_SPLITS,
  REWRITE_GROUPS,
  type RewriteKind,
} from "./allowlist/mod.ts";
import type { WorkLayout } from "./layout.ts";
import { addDirectPatches, type MetadataFactory } from "./patch/mod.ts";
import { buildRewriteTargets } from "./rewrite/mod.ts";

export const EXACT_SELECTOR_LAYOUT_ACTION = "apply_exact_selector_layout";
const ALLOWED_SITE_COUNT = 1543;

export type ExactPatchMap = Readonly<{
  /** 共有luiが割れてstubへ回した低位命令(`far_lo`)。stub生成を伴う配置だけが許す。 */
  farCount: number;
  rows: readonly InstructionPatch[];
  splitCount: number;
}>;

const hex = (value: number) => "0x" + (value >>> 0).toString(16);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function metadataFactory(layout: WorkLayout): MetadataFactory {
  return (
    functionName,
    address,
    form,
    oldReference,
    newReference,
    usage,
    rationale = "static allowlistの連続全体配置へ追従",
  ): PatchMetadata => ({
    action: EXACT_SELECTOR_LAYOUT_ACTION,
    functionName,
    newReference,
    oldReference,
    rationale: `N=${layout.songs} E=${layout.entries}: ${rationale}`,
    referenceForm: form,
    sourceAddress: hex(address),
    usage,
  });
}

function rewriteReference(
  layout: WorkLayout,
  kind: RewriteKind,
): readonly [number, number] {
  if (kind === "recordStrideShift") return [0x3e8, layout.recordSize];
  if (kind === "twentySongsStrideMultiply") return [20 * 99, 20 * layout.songs];
  return [4 * 99, 4 * layout.songs];
}

function allowedSites(
  directGroups: readonly DirectGroup[],
): ReadonlySet<number> {
  const sites = new Set<number>();
  for (const group of directGroups) {
    for (const [low, , high] of group.sites) {
      sites.add(low);
      if (high !== 0) sites.add(high);
    }
  }
  for (const [, , split] of HIGH_SPLITS) sites.add(split);
  for (const [, , alias] of HIGH_ALIASES) sites.add(alias);
  for (const address of FOUR_SONG_INCREMENTS) sites.add(address);
  for (const group of REWRITE_GROUPS) {
    for (const address of group.sites) sites.add(address);
  }
  return sites;
}

export function buildExactPatchMapForLayout(
  elf: WordSource,
  layout: WorkLayout,
  directGroups: readonly DirectGroup[],
): ExactPatchMap {
  const wordAt = (address: number) => requireWord(elf, address);
  const book = new InstructionPatchBook(elf);
  const makeMetadata = metadataFactory(layout);
  const direct = addDirectPatches(
    book,
    layout,
    directGroups,
    makeMetadata,
    wordAt,
  );

  for (const address of FOUR_SONG_INCREMENTS) {
    const target = 4 * layout.songs;
    book.add(
      address,
      withImmediate(wordAt(address), target),
      makeMetadata(
        "選曲キャッシュ構築",
        address,
        "single16",
        hex(396),
        hex(target),
        "fourSongs",
      ),
    );
  }

  const rewriteTargets = buildRewriteTargets(layout, wordAt);
  for (const group of REWRITE_GROUPS) {
    const [oldReference, newReference] = rewriteReference(layout, group.kind);
    for (const address of group.sites) {
      const targetWord = rewriteTargets.get(address);
      assert(
        targetWord !== undefined,
        `${hex(address)}のrewrite targetがありません`,
      );
      book.add(
        address,
        targetWord,
        makeMetadata(
          group.functionName,
          address,
          group.strategy,
          hex(oldReference),
          hex(newReference),
          group.kind,
        ),
      );
    }
  }

  const allowed = allowedSites(directGroups), rows = book.rows();
  assert(
    allowed.size === ALLOWED_SITE_COUNT,
    "allowlistが登録数と一致しません",
  );
  assert(
    rows.every((row) => allowed.has(row.address)),
    "allowlist外のpatchがあります",
  );
  const pb = layout.songs === 99 && layout.entries === 495;
  assert(!pb || rows.length === 0, "原盤配置のpatch帳が0件ではありません");
  assert(!pb || direct.splitCount === 0, "原盤配置で共有lui分離が発生しました");
  return { farCount: direct.farCount, rows, splitCount: direct.splitCount };
}
