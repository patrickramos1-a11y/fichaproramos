import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  const raw = readFileSync(path, "utf8");
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, "")];
      }),
  );
}

const env = loadEnv(new URL("../.env", import.meta.url));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

async function purge(table) {
  const { error } = await supabase.from(table).delete().neq("id", "");
  if (error) throw new Error(`${table}: ${error.message}`);
}

const before = {};
for (const table of ["clients", "empreendimentos", "projects", "surveys"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  before[table] = count ?? 0;
}

for (const table of ["surveys", "projects", "empreendimentos", "clients"]) {
  await purge(table);
}

const after = {};
for (const table of ["clients", "empreendimentos", "projects", "surveys"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  after[table] = count ?? 0;
}

console.log(JSON.stringify({ before, after }, null, 2));
