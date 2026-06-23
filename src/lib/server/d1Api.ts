import { createClient } from "@supabase/supabase-js";

type D1Result<T = Record<string, unknown>> = { results?: T[] };
type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  all: <T = Record<string, unknown>>() => Promise<D1Result<T>>;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  run: () => Promise<unknown>;
};
type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<unknown[]>;
};
type R2Bucket = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: Record<string, string> }) => Promise<unknown>;
  get: (key: string) => Promise<{ body: ReadableStream | null; httpMetadata?: Record<string, string> } | null>;
};

export type D1Env = {
  DB?: D1Database;
  ATTACHMENTS?: R2Bucket;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
};

const TABLES = [
  "clients",
  "empreendimentos",
  "projects",
  "surveys",
  "survey_templates",
  "custom_survey_types",
  "annual_environmental_records",
  "form_overrides",
  "app_users",
] as const;

type TableName = (typeof TABLES)[number];

type SyncOperation = {
  operationId?: string;
  table: string;
  recordId: string;
  type: "upsert" | "delete" | "restore";
  payload?: Record<string, unknown>;
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

function assertDB(env: D1Env): D1Database {
  if (!env.DB) throw new Response("D1 binding DB is not configured", { status: 503 });
  return env.DB;
}

function tableName(table: string): TableName {
  if (!TABLES.includes(table as TableName)) {
    throw new Response("Invalid table", { status: 400 });
  }
  return table as TableName;
}

async function getUserId(request: Request, env: D1Env) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const token = authHeader.slice("Bearer ".length);
  const supabaseUrl = env.SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Response("Supabase auth env is not configured", { status: 503 });
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Response("Unauthorized", { status: 401 });
  return String(data.claims.sub);
}

function parseRow(row: { data: string }) {
  return JSON.parse(row.data);
}

async function listTable(db: D1Database, table: TableName) {
  if (table === "app_users") {
    const rows = await db.prepare("select id, name, email, created_at as createdAt from app_users order by name asc").all();
    return rows.results ?? [];
  }
  const rows = await db.prepare(`select data from ${table} order by updated_at desc`).all<{ data: string }>();
  return (rows.results ?? []).map(parseRow);
}

function rowFields(table: TableName, row: Record<string, unknown>, userId: string) {
  const data = row.data ?? row;
  const item = typeof data === "string" ? JSON.parse(data) : data as Record<string, unknown>;
  const serialized = JSON.stringify(item);
  const id = String(row.id ?? item.id);
  const clientId = String(row.client_id ?? item.clientId ?? "");
  const projectId = row.project_id ?? item.projectId ?? null;
  const empreendimentoId = row.empreendimento_id ?? item.empreendimentoId ?? null;

  switch (table) {
    case "clients":
    case "survey_templates":
    case "custom_survey_types":
      return { columns: "id, data, created_by, updated_at", values: [id, serialized, userId, new Date().toISOString()] };
    case "empreendimentos":
    case "annual_environmental_records":
      return { columns: "id, client_id, data, created_by, updated_at", values: [id, clientId, serialized, userId, new Date().toISOString()] };
    case "projects":
      return { columns: "id, client_id, empreendimento_id, data, created_by, updated_at", values: [id, clientId, empreendimentoId, serialized, userId, new Date().toISOString()] };
    case "surveys":
      return { columns: "id, client_id, project_id, empreendimento_id, data, created_by, updated_at", values: [id, clientId, projectId, empreendimentoId, serialized, userId, new Date().toISOString()] };
    case "form_overrides":
      return { columns: "id, data, updated_by, updated_at", values: [id || "singleton", serialized, userId, new Date().toISOString()] };
    case "app_users":
      return { columns: "id, name, email, created_at", values: [String(row.id ?? row.email), String(row.name ?? ""), String(row.email ?? ""), new Date().toISOString()] };
  }
}

function upsertStatement(db: D1Database, table: TableName, row: Record<string, unknown>, userId: string) {
  const fields = rowFields(table, row, userId);
  const columns = fields.columns.split(", ");
  const placeholders = columns.map(() => "?").join(", ");
  const updates = columns
    .filter((column) => column !== "id" && column !== "created_by")
    .map((column) => `${column} = excluded.${column}`)
    .join(", ");
  return db
    .prepare(`insert into ${table} (${fields.columns}) values (${placeholders}) on conflict(id) do update set ${updates}`)
    .bind(...fields.values);
}

async function applySync(db: D1Database, userId: string, operations: SyncOperation[]) {
  const statements: D1PreparedStatement[] = [];
  const applied: string[] = [];
  for (const operation of operations) {
    const table = tableName(operation.table);
    const operationId = operation.operationId ?? `${operation.type}:${table}:${operation.recordId}`;
    if (operation.type === "upsert") {
      if (!operation.payload) throw new Response("Missing upsert payload", { status: 400 });
      statements.push(upsertStatement(db, table, operation.payload, userId));
    } else if (operation.type === "delete") {
      statements.push(db.prepare(`delete from ${table} where id = ?`).bind(operation.recordId));
    } else if (operation.type === "restore" && table === "surveys") {
      statements.push(db.prepare(`
        insert into surveys (id, client_id, project_id, empreendimento_id, data, created_by, updated_at)
        select id, client_id, project_id, empreendimento_id, data, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        from deleted_surveys_audit
        where id = ?
        on conflict(id) do update set
          client_id = excluded.client_id,
          project_id = excluded.project_id,
          empreendimento_id = excluded.empreendimento_id,
          data = excluded.data,
          updated_at = excluded.updated_at
      `).bind(userId, operation.recordId));
    }
    statements.push(db.prepare(`
      insert into sync_operations_log (operation_id, table_name, record_id, operation_type, applied_by)
      values (?, ?, ?, ?, ?)
      on conflict(operation_id) do update set applied_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), error = null
    `).bind(operationId, table, operation.recordId, operation.type, userId));
    applied.push(operationId);
  }
  if (statements.length) await db.batch(statements);
  return applied;
}

async function getPublicSurvey(db: D1Database, token: string) {
  const row = await db.prepare(`
    select data from surveys
    where json_extract(data, '$.publicShareToken') = ?
      and json_extract(data, '$.publicShareEnabled') = 1
      and coalesce(json_extract(data, '$.publicShareRevokedAt'), '') = ''
    limit 1
  `).bind(token).first<{ data: string }>();
  if (!row) return null;
  const survey = parseRow(row);
  const customTypeId = survey.customTypeId;
  const customType = customTypeId
    ? await db.prepare("select data from custom_survey_types where id = ?").bind(customTypeId).first<{ data: string }>()
    : null;
  const formOverrides = await db.prepare("select data from form_overrides where id = 'singleton'").first<{ data: string }>();
  return {
    survey,
    customType: customType ? parseRow(customType) : null,
    formOverrides: formOverrides ? parseRow(formOverrides) : {},
  };
}

async function updatePublicSurvey(db: D1Database, token: string, patch: Record<string, unknown>, editorName?: string) {
  const payload = await getPublicSurvey(db, token);
  if (!payload?.survey) throw new Response("Link publico invalido, revogado ou expirado.", { status: 404 });
  const survey = {
    ...payload.survey,
    ...(patch.modules ? { modules: patch.modules } : {}),
    ...(patch.pendencias ? { pendencias: patch.pendencias } : {}),
    ...(patch.signatures ? { signatures: patch.signatures } : {}),
    publicShareLastSubmittedAt: new Date().toISOString(),
    ...(editorName?.trim() ? { publicShareLastEditorName: editorName.trim() } : {}),
  };
  await db.prepare("update surveys set data = ?, updated_at = ? where id = ?")
    .bind(JSON.stringify(survey), new Date().toISOString(), survey.id)
    .run();
  return getPublicSurvey(db, token);
}

async function uploadAttachment(request: Request, env: D1Env) {
  if (!env.ATTACHMENTS) throw new Response("R2 binding ATTACHMENTS is not configured", { status: 503 });
  await getUserId(request, env);
  const form = await request.formData();
  const file = form.get("file");
  const surveyId = String(form.get("surveyId") ?? "");
  const attachmentId = String(form.get("attachmentId") ?? crypto.randomUUID());
  if (!(file instanceof File) || !surveyId) throw new Response("Invalid upload", { status: 400 });
  const key = `surveys/${surveyId}/${attachmentId}/${file.name}`;
  await env.ATTACHMENTS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  return json({ id: attachmentId, r2Key: key, name: file.name, type: file.type, size: file.size });
}

async function getAttachment(request: Request, env: D1Env) {
  if (!env.ATTACHMENTS) throw new Response("R2 binding ATTACHMENTS is not configured", { status: 503 });
  await getUserId(request, env);
  const key = new URL(request.url).searchParams.get("key");
  if (!key) throw new Response("Missing key", { status: 400 });
  const object = await env.ATTACHMENTS.get(key);
  if (!object?.body) throw new Response("Attachment not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}

export async function handleD1Api(request: Request, env: D1Env): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return undefined;
  try {
    const db = assertDB(env);
    if (url.pathname === "/api/app-users" && request.method === "GET") {
      return json({ appUsers: await listTable(db, "app_users") });
    }
    if (url.pathname === "/api/db/bootstrap" && request.method === "GET") {
      await getUserId(request, env);
      const [clients, empreendimentos, projects, surveys, templates, customSurveyTypes, annualRecords, appUsers, formOverridesRow] = await Promise.all([
        listTable(db, "clients"),
        listTable(db, "empreendimentos"),
        listTable(db, "projects"),
        listTable(db, "surveys"),
        listTable(db, "survey_templates"),
        listTable(db, "custom_survey_types"),
        listTable(db, "annual_environmental_records"),
        listTable(db, "app_users"),
        db.prepare("select data from form_overrides where id = 'singleton'").first<{ data: string }>(),
      ]);
      return json({
        clients,
        empreendimentos,
        projects,
        surveys,
        templates,
        customSurveyTypes,
        annualRecords,
        appUsers,
        formOverrides: formOverridesRow ? parseRow(formOverridesRow) : {},
      });
    }
    if ((url.pathname === "/api/db/sync" || url.pathname === "/api/db/retry") && request.method === "POST") {
      const userId = await getUserId(request, env);
      const body = await request.json() as { operations?: SyncOperation[] };
      const applied = await applySync(db, userId, body.operations ?? []);
      return json({ applied, failed: [] });
    }
    if (url.pathname === "/api/db/restore-survey" && request.method === "POST") {
      const userId = await getUserId(request, env);
      const body = await request.json() as { id?: string };
      if (!body.id) return json({ error: "Missing id" }, { status: 400 });
      const applied = await applySync(db, userId, [{ table: "surveys", recordId: body.id, type: "restore" }]);
      return json({ applied });
    }
    if (url.pathname === "/api/attachments/upload" && request.method === "POST") {
      return uploadAttachment(request, env);
    }
    if (url.pathname === "/api/attachments/file" && request.method === "GET") {
      return getAttachment(request, env);
    }
    const publicMatch = url.pathname.match(/^\/api\/public-survey\/([^/]+)$/);
    if (publicMatch && request.method === "GET") {
      const payload = await getPublicSurvey(db, decodeURIComponent(publicMatch[1]));
      return payload ? json(payload) : json({ error: "Link invalido, revogado ou expirado." }, { status: 404 });
    }
    if (publicMatch && request.method === "POST") {
      const body = await request.json() as { patch?: Record<string, unknown>; editorName?: string };
      const payload = await updatePublicSurvey(db, decodeURIComponent(publicMatch[1]), body.patch ?? {}, body.editorName);
      return json(payload);
    }
    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected API error" }, { status: 500 });
  }
}
