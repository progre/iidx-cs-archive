// 組の表を選ぶ規則。候補の値を組み立てて確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import {
  draftMoviesOf,
  type FrontFacts,
  hasDedicatedMovie,
  pickFront,
} from "./front_rule.ts";

const facts = (
  name: string,
  dedicatedMovie: boolean,
  overlaySheets: number,
  newness: number,
) => ({ dedicatedMovie, name, newness, overlaySheets });

type Candidate = ReturnType<typeof facts>;

const pick = (candidates: Candidate[], owner = candidates[0]) =>
  pickFront<Candidate & FrontFacts>(
    candidates,
    owner,
    (each) => each,
    (each) => each.name,
  ).name;

Deno.test("専用ムービー、オーバーレイの枚数、世代の新しさの順に比べる", () => {
  assertEquals(
    pick([facts("new", false, 9, 9), facts("movie", true, 0, 0)]),
    "movie",
  );
  assertEquals(
    pick([facts("new", true, 1, 9), facts("sheets", true, 2, 0)]),
    "sheets",
  );
  assertEquals(
    pick([facts("old", true, 1, 1), facts("new", true, 1, 2)]),
    "new",
  );
});

Deno.test("すべて同じなら枠の持ち主を選び、持ち主が無ければ止まる", () => {
  const [a, b, c] = [
    facts("a", true, 1, 1),
    facts("b", true, 1, 1),
    facts("c", false, 0, 0),
  ];
  assertEquals(pick([a, b, c], b), "b");
  assertThrows(() => pick([a, b, c], c), Error, "a, b");
});

Deno.test("汎用のムービーだけの曲と、ムービーの無い曲は、専用ムービーを持たない", () => {
  const isGeneric = (movie: string) => movie === "3rd:315";
  assertEquals(hasDedicatedMovie(["3rd:315"], isGeneric), false);
  assertEquals(hasDedicatedMovie([], isGeneric), false);
  assertEquals(hasDedicatedMovie(["3rd:315", "3rd:20"], isGeneric), true);
});

Deno.test("CSA が使わない本目のムービー(excluded)は、規則で数えない", () => {
  const video = (sourceFileIndex: number, path: "excluded" | "reencode") =>
    ({ fields: [], kind: "video", path, sourceFileIndex }) as never;
  const row = {
    sourceAssets: [video(737, "reencode"), video(738, "excluded")],
    sourceGeneration: "8th",
  } as never;
  assertEquals(draftMoviesOf(row), ["8th:737"]);
});
