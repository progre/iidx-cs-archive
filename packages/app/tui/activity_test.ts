import { assertEquals } from "@std/assert";
import { Activity, lapSteps } from "./activity.ts";

Deno.test("今の作業が工程で何番目かを、作業名の前に示す", () => {
  const activity = new Activity(lapSteps({ era1: true, pb: false }));
  activity.timer("time 4th era1 movie formats");
  activity.logLine("3/40 4th movie format");
  assertEquals(activity.line, "[2/8] Checking movies (3/40)");
});

Deno.test("作業名と件数を、1行にまとめる", () => {
  const activity = new Activity();
  activity.timer("time 10th video export");
  activity.logLine("52/88 10th video");
  assertEquals(activity.line, "Copying videos (52/88)");
});

Deno.test("次の作業に移ると件数を消し、書き込みが始まると書き込んだ量を出す", () => {
  const activity = new Activity();
  activity.logLine("52/88 10th video");
  activity.timer("time ISO write");
  activity.logLine("  written 1.1 GB...");
  assertEquals(activity.line, "Writing ISO · 1.1 GB written");
});
