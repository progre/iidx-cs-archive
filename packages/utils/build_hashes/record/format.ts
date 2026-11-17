const INDENT = "  ";

function isDigest(value: unknown): boolean {
  return typeof value === "object" && value !== null && "sha256" in value;
}

function lines(value: unknown, depth: number): string {
  if (typeof value !== "object" || value === null || isDigest(value)) {
    return JSON.stringify(value);
  }
  if (Object.keys(value).length === 0) {
    return "{}";
  }
  const pad = INDENT.repeat(depth + 1);
  const body = Object.entries(value).map(([key, child]) =>
    `${pad}${JSON.stringify(key)}: ${lines(child, depth + 1)}`
  );
  return `{\n${body.join(",\n")}\n${INDENT.repeat(depth)}}`;
}

/** 記録を JSON にする。ハッシュ1件を1行にして、差分を行単位で読めるようにする */
export function stringifyRecord(value: unknown): string {
  return lines(value, 0) + "\n";
}
