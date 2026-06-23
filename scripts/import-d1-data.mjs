import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const jsonPath = process.argv[2];
const databaseName = process.argv[3] || "fichaproramos-db";
const remote = process.argv.includes("--remote");

if (!jsonPath) {
  console.error(
    "Usage: node scripts/import-d1-data.mjs <export.json> [databaseName] [--remote]",
  );
  process.exit(1);
}

const allowedTables = new Set([
  "clients",
  "empreendimentos",
  "projects",
  "surveys",
  "survey_templates",
  "custom_survey_types",
  "annual_environmental_records",
  "form_overrides",
  "app_users",
]);

const envelope = JSON.parse(await readFile(jsonPath, "utf8"));
const tables = envelope.tables || {};
const report = { imported: {}, skipped: {}, errors: [] };

function sqlString(value) {
  return value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
}

function recordId(row) {
  return row.id || row.key || row.user_id || row.email;
}

function buildUpsert(table, row) {
  const id = recordId(row);
  const now = new Date().toISOString();
  const data = JSON.stringify(row);

  if (table === "form_overrides") {
    return `
      INSERT INTO form_overrides (id, user_id, key, data, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(row.user_id)}, ${sqlString(row.key)}, ${sqlString(data)}, ${sqlString(row.updated_at || now)})
      ON CONFLICT(user_id, key) DO UPDATE SET
        data = excluded.data,
        updated_at = CASE WHEN excluded.updated_at > form_overrides.updated_at THEN excluded.updated_at ELSE form_overrides.updated_at END;
    `;
  }

  if (table === "app_users") {
    return `
      INSERT INTO app_users (id, email, name, role, data, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(row.email)}, ${sqlString(row.name)}, ${sqlString(row.role)}, ${sqlString(data)}, ${sqlString(row.updated_at || now)})
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        role = excluded.role,
        data = excluded.data,
        updated_at = CASE WHEN excluded.updated_at > app_users.updated_at THEN excluded.updated_at ELSE app_users.updated_at END;
    `;
  }

  return `
    INSERT INTO ${table} (id, user_id, data, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(row.user_id)}, ${sqlString(data)}, ${sqlString(row.updated_at || now)})
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      data = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.data ELSE ${table}.data END,
      updated_at = CASE WHEN excluded.updated_at >= ${table}.updated_at THEN excluded.updated_at ELSE ${table}.updated_at END;
  `;
}

function executeSql(sql) {
  const args = ["wrangler", "d1", "execute", databaseName, "--command", sql];
  if (remote) args.splice(4, 0, "--remote");

  const result = spawnSync("npx.cmd", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `wrangler exited ${result.status}`);
  }
}

for (const [table, rows] of Object.entries(tables)) {
  if (!allowedTables.has(table)) continue;
  report.imported[table] = 0;
  report.skipped[table] = 0;

  for (const row of rows || []) {
    if (!recordId(row)) {
      report.skipped[table] += 1;
      continue;
    }

    try {
      executeSql(buildUpsert(table, row));
      report.imported[table] += 1;
    } catch (error) {
      report.errors.push({ table, id: recordId(row), error: error.message });
    }
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);
