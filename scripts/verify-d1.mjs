import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const databaseName = process.argv[2] || "fichaproramos-db";
const remote = process.argv.includes("--remote");
const bootstrapUrlArg = process.argv.find((arg) => arg.startsWith("--bootstrap-url="));
const tokenArg = process.argv.find((arg) => arg.startsWith("--token="));
const bootstrapUrl = bootstrapUrlArg?.slice("--bootstrap-url=".length);
const token = tokenArg?.slice("--token=".length) || process.env.SUPABASE_ACCESS_TOKEN;
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

const expectedTables = [
  "clients",
  "empreendimentos",
  "projects",
  "surveys",
  "survey_templates",
  "custom_survey_types",
  "annual_environmental_records",
  "form_overrides",
  "app_users",
  "deleted_surveys_audit",
  "sync_operations_log",
];

function quoteCmd(value) {
  const text = String(value);
  if (!/[ "'&|<>^]/.test(text)) return text;
  return `"${text.replaceAll('"', '\\"')}"`;
}

function runCli(args) {
  if (process.platform !== "win32") {
    return spawnSync(npxBin, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      maxBuffer: 10 * 1024 * 1024,
    });
  }
  return spawnSync("cmd.exe", ["/d", "/s", "/c", [npxBin, ...args.map(quoteCmd)].join(" ")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function runWrangler(sql) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "fichaproramos-d1-verify-"));
  const sqlPath = path.join(tempDir, "query.sql");
  await writeFile(sqlPath, sql);
  const args = ["wrangler", "d1", "execute", databaseName, "--file", sqlPath, "--json", "--yes"];
  if (remote) args.splice(4, 0, "--remote");
  else args.splice(4, 0, "--local");

  const result = runCli(args);
  await rm(tempDir, { recursive: true, force: true });

  if (result.error || result.status !== 0) {
    if (result.error) throw result.error;
    throw new Error(result.stderr || result.stdout || `wrangler exited ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function resultRows(output) {
  const first = Array.isArray(output) ? output[0] : output;
  return first?.results || first?.result?.[0]?.results || [];
}

const tableRows = resultRows(await runWrangler(`
  SELECT name
  FROM sqlite_master
  WHERE type = 'table'
  ORDER BY name;
`));
const present = new Set(tableRows.map((row) => row.name));
const missing = expectedTables.filter((table) => !present.has(table));

const counts = {};
for (const table of expectedTables.filter((table) => present.has(table))) {
  const rows = resultRows(await runWrangler(`SELECT COUNT(*) AS count FROM ${table};`));
  counts[table] = Number(rows[0]?.count ?? 0);
}

let bootstrap = { checked: false };
if (bootstrapUrl) {
  if (!token) {
    bootstrap = { checked: false, error: "Missing --token or SUPABASE_ACCESS_TOKEN for bootstrap check" };
  } else {
    const response = await fetch(bootstrapUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    bootstrap = {
      checked: true,
      ok: response.ok,
      status: response.status,
      body: response.ok ? undefined : await response.text(),
    };
  }
}

const report = {
  databaseName,
  remote,
  checkedAt: new Date().toISOString(),
  missingTables: missing,
  counts,
  bootstrap,
};

console.log(JSON.stringify(report, null, 2));
if (missing.length || bootstrap.ok === false) process.exit(1);
