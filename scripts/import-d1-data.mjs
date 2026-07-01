import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const jsonPath = process.argv[2];
const databaseName = process.argv[3] || "fichaproramos-db";
const remote = process.argv.includes("--remote");
const outDirArg = process.argv.find((arg) => arg.startsWith("--out-dir="));
const outDir = outDirArg ? outDirArg.slice("--out-dir=".length) : "exports";

if (!jsonPath) {
  console.error(
    "Usage: node scripts/import-d1-data.mjs <export.json> [databaseName] [--remote] [--out-dir=exports]",
  );
  process.exit(1);
}

const tableOrder = [
  "clients",
  "empreendimentos",
  "projects",
  "surveys",
  "survey_templates",
  "custom_survey_types",
  "annual_environmental_records",
  "form_overrides",
  "app_users",
];

const envelope = JSON.parse(await readFile(jsonPath, "utf8"));
const tables = envelope.tables || {};
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
const report = {
  startedAt: new Date().toISOString(),
  source: jsonPath,
  databaseName,
  remote,
  imported: {},
  skipped: {},
  errors: [],
};

function sqlString(value) {
  return value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function recordId(row, table) {
  if (table === "form_overrides") return row.id || "singleton";
  return row.id || row.key || row.user_id || row.email;
}

function rowData(row) {
  if (typeof row.data === "string") {
    try {
      return JSON.parse(row.data);
    } catch {
      return row;
    }
  }
  return row.data && typeof row.data === "object" ? row.data : row;
}

function timestamp(row) {
  return row.updated_at || row.updatedAt || row.created_at || row.createdAt || new Date().toISOString();
}

function createdBy(row, data) {
  return row.created_by || row.user_id || data.createdBy || data.userId || null;
}

function buildUpsert(table, row) {
  const data = rowData(row);
  const id = String(recordId(row, table));
  const serialized = JSON.stringify(data);
  const updatedAt = timestamp(row);

  if (table === "form_overrides") {
    return `
      INSERT INTO form_overrides (id, data, updated_by, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(serialized)}, ${sqlString(row.updated_by || row.user_id || null)}, ${sqlString(updatedAt)})
      ON CONFLICT(id) DO UPDATE SET
        data = CASE WHEN excluded.updated_at >= form_overrides.updated_at THEN excluded.data ELSE form_overrides.data END,
        updated_by = CASE WHEN excluded.updated_at >= form_overrides.updated_at THEN excluded.updated_by ELSE form_overrides.updated_by END,
        updated_at = CASE WHEN excluded.updated_at >= form_overrides.updated_at THEN excluded.updated_at ELSE form_overrides.updated_at END;
    `;
  }

  if (table === "app_users") {
    const name = row.name || data.name || row.email || data.email || id;
    const email = row.email || data.email || `${id}@local.invalid`;
    const createdAt = row.created_at || row.createdAt || updatedAt;
    return `
      INSERT INTO app_users (id, name, email, created_at)
      VALUES (${sqlString(id)}, ${sqlString(name)}, ${sqlString(email)}, ${sqlString(createdAt)})
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email;
    `;
  }

  const common = {
    createdBy: createdBy(row, data),
    updatedAt,
  };
  const clientId = row.client_id || data.clientId || null;
  const projectId = row.project_id || data.projectId || null;
  const empreendimentoId = row.empreendimento_id || data.empreendimentoId || null;

  if (table === "empreendimentos" || table === "annual_environmental_records") {
    return `
      INSERT INTO ${table} (id, client_id, data, created_by, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(clientId)}, ${sqlString(serialized)}, ${sqlString(common.createdBy)}, ${sqlString(common.updatedAt)})
      ON CONFLICT(id) DO UPDATE SET
        client_id = excluded.client_id,
        data = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.data ELSE ${table}.data END,
        created_by = COALESCE(${table}.created_by, excluded.created_by),
        updated_at = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.updated_at ELSE ${table}.updated_at END;
    `;
  }

  if (table === "projects") {
    return `
      INSERT INTO projects (id, client_id, empreendimento_id, data, created_by, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(clientId)}, ${sqlString(empreendimentoId)}, ${sqlString(serialized)}, ${sqlString(common.createdBy)}, ${sqlString(common.updatedAt)})
      ON CONFLICT(id) DO UPDATE SET
        client_id = excluded.client_id,
        empreendimento_id = excluded.empreendimento_id,
        data = CASE WHEN excluded.updated_at >= projects.updated_at THEN excluded.data ELSE projects.data END,
        created_by = COALESCE(projects.created_by, excluded.created_by),
        updated_at = CASE WHEN excluded.updated_at >= projects.updated_at THEN excluded.updated_at ELSE projects.updated_at END;
    `;
  }

  if (table === "surveys") {
    return `
      INSERT INTO surveys (id, client_id, project_id, empreendimento_id, data, created_by, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(clientId)}, ${sqlString(projectId)}, ${sqlString(empreendimentoId)}, ${sqlString(serialized)}, ${sqlString(common.createdBy)}, ${sqlString(common.updatedAt)})
      ON CONFLICT(id) DO UPDATE SET
        client_id = excluded.client_id,
        project_id = excluded.project_id,
        empreendimento_id = excluded.empreendimento_id,
        data = CASE WHEN excluded.updated_at >= surveys.updated_at THEN excluded.data ELSE surveys.data END,
        created_by = COALESCE(surveys.created_by, excluded.created_by),
        updated_at = CASE WHEN excluded.updated_at >= surveys.updated_at THEN excluded.updated_at ELSE surveys.updated_at END;
    `;
  }

  return `
    INSERT INTO ${table} (id, data, created_by, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(serialized)}, ${sqlString(common.createdBy)}, ${sqlString(common.updatedAt)})
    ON CONFLICT(id) DO UPDATE SET
      data = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.data ELSE ${table}.data END,
      created_by = COALESCE(${table}.created_by, excluded.created_by),
      updated_at = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.updated_at ELSE ${table}.updated_at END;
  `;
}

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

async function executeSql(sql) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "fichaproramos-d1-import-"));
  const sqlPath = path.join(tempDir, "statement.sql");
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
}

for (const table of tableOrder) {
  const rows = tables[table] || [];
  report.imported[table] = 0;
  report.skipped[table] = 0;

  for (const row of rows) {
    const id = recordId(row, table);
    if (!id) {
      report.skipped[table] += 1;
      continue;
    }

    try {
      await executeSql(buildUpsert(table, row));
      report.imported[table] += 1;
    } catch (error) {
      report.errors.push({ table, id: String(id), error: error.message });
    }
  }
}

report.finishedAt = new Date().toISOString();
await mkdir(outDir, { recursive: true });
const reportPath = path.join(outDir, `d1-import-report-${Date.now()}.json`);
await writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ ...report, reportPath }, null, 2));
if (report.errors.length) process.exit(1);
