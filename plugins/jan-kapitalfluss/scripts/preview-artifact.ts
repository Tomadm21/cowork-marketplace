/**
 * Render the live-artifact template with a REAL planned run injected, into a self-contained
 * preview HTML you can open directly. Dev/demo only.
 *   PLUGIN_ROOT="$PWD" bun scripts/preview-artifact.ts [store] [csv]
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { resolveRoot, underRoot } from "../engine/util/paths";
import { dispatch } from "../mcp/server";

const root = resolveRoot(process.argv[4] ?? undefined);
const store = process.argv[2] ?? "linde";
const csv = process.argv[3] ?? `fixtures/commerzbank/${store}-2026-05.csv`;

const payload = await dispatch("plan_run", { storeId: store, csvPath: csv });
const template = await readFile(underRoot(root, "artifacts", "change-overview.template.html"), "utf8");
const injected = template.replace(
  "</head>",
  `  <script>window.RUN_DATA = ${JSON.stringify(payload)};</script>\n</head>`,
);

const outDir = underRoot(root, "out", "preview");
await mkdir(outDir, { recursive: true });
const outPath = join(outDir, "artifact-preview.html");
await writeFile(outPath, injected);
console.log(outPath);
