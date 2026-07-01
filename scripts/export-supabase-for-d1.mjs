import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function loadEnvFile(filePath = ".env") {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [rawKey, ...rest] = trimmed.split("=");
      const key = rawKey.trim();
      if (!process.env[key]) {
        process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // .env is optional; CI can provide real environment variables.
  }
}

await loadEnvFile();

const tables = [
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

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error(
    `Missing ${[
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean).join(" and ")} environment variables.`,
  );
  process.exit(1);
}

const outDir = process.argv[2] || "exports";
const outFile = path.join(outDir, `supabase-export-${Date.now()}.json`);
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchTable(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

const payload = { exportedAt: new Date().toISOString(), source: "supabase", tables: {} };

for (const table of tables) {
  const rows = await fetchTable(table);
  payload.tables[table] = rows;
  console.log(`${table}: ${rows.length}`);
}

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(payload, null, 2));
console.log(`Export saved to ${outFile}`);
