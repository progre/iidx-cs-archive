import { assertThrows } from "@std/assert";
import { assembleSongRows } from "./assemble.ts";

Deno.test("周回で作られていない世代があれば例外にする", () => {
  assertThrows(
    () => assembleSongRows(new Map(), ["3rd"]),
    Error,
    "周回で作られていない",
  );
});
