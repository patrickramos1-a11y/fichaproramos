import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  Client, Empreendimento, Project, Survey, ModuleState, FieldStatus, Pendencia,
  SurveyType, Attachment, SurveyTemplate,
  FormStructureOverrides, FieldPatch, SubgroupPatch, ModulePatch, SubgroupDef, FieldDef,
  CustomSurveyType, CustomTypeModuleBinding, ModuleRequirement,
  PhotoChecklistAnswer,
} from "./types";
import {
  getModulesForType, ensureLegacyAdapters, getEffectiveModulesForType,
  getEffectiveModulesForCustomType,
  MODULE_PRESETS,
  setGlobalFormOverrides,
} from "./modules";
import { BUILTIN_SURVEY_TYPE_IDS, SURVEY_TYPES } from "./types";
import { DEFAULT_BUILTIN_ICONS } from "./typeIcons";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { saveSnapshot, loadSnapshot } from "./offlineSnapshot";

interface DB {
  clients: Client[];
  empreendimentos: Empreendimento[];
  projects: Project[];
  surveys: Survey[];
  templates: SurveyTemplate[];
  formOverrides: FormStructureOverrides;
  customSurveyTypes: CustomSurveyType[];
}

interface DBStatus {
  hydrated: boolean;
  persistPending: boolean;
  persistenceError?: string;
  authed: boolean;
}

interface StoreRuntime {
  db: DB;
  status: DBStatus;
  listeners: Set<() => void>;
  initPromise?: Promise<void>;
  lastSyncedDb: DB;
  syncTimer?: number;
  syncChain: Promise<void>;
  channel?: RealtimeChannel;
  authBound: boolean;
  userId?: string;
  pendingFlush: boolean;
}

const EMPTY_DB: DB = {
  clients: [], empreendimentos: [], projects: [], surveys: [],
  templates: [], formOverrides: {}, customSurveyTypes: [],
};

function createModuleState(): ModuleState {
  return {
    status: "nao_iniciado",
    values: {},
    fieldStatus: {},
    attachments: [],
    fieldNotes: {},
    nonApplicable: {},
  };
}

function normalizeModuleState(module?: Partial<ModuleState> | null): ModuleState {
  return {
    status: module?.status ?? "nao_iniciado",
    values: module?.values ?? {},
    fieldStatus: module?.fieldStatus ?? {},
    notes: module?.notes,
    attachments: Array.isArray(module?.attachments) ? module.attachments : [],
    fieldNotes: module?.fieldNotes ?? {},
    subgroupNotes: module?.subgroupNotes ?? {},
    nonApplicable: module?.nonApplicable ?? {},
    naModule: module?.naModule ?? false,
    naSubgroups: module?.naSubgroups ?? {},
    moduleDone: module?.moduleDone ?? false,
    subgroupDone: module?.subgroupDone ?? {},
    photoChecklist: Array.isArray(module?.photoChecklist) ? module.photoChecklist : undefined,
    photoChecklistKeys: Array.isArray(module?.photoChecklistKeys) ? module.photoChecklistKeys : undefined,
    photoLiberadoDivulgacao:
      typeof module?.photoLiberadoDivulgacao === "boolean" ? module.photoLiberadoDivulgacao : undefined,
  };
}

function normalizeModuleBindings(bindings: unknown): CustomTypeModuleBinding[] {
  if (!Array.isArray(bindings)) return [];
  return bindings
    .filter(
      (binding): binding is { moduleId?: unknown; requirement?: unknown; color?: unknown } =>
        !!binding && typeof binding === "object",
    )
    .map((binding) => {
      const requirement: ModuleRequirement =
        binding.requirement === "obrigatorio"
        || binding.requirement === "recomendado"
        || binding.requirement === "opcional"
          ? binding.requirement
          : "opcional";

      return {
        moduleId: typeof binding.moduleId === "string" ? binding.moduleId : "",
        requirement,
        color: typeof binding.color === "string" ? binding.color : undefined,
      };
    })
    .filter((binding) => binding.moduleId);
}

function normalizeCustomSurveyType(type: CustomSurveyType): CustomSurveyType {
  return {
    ...type,
    moduleBindings: normalizeModuleBindings(type.moduleBindings),
    scopedOverrides:
      type.scopedOverrides && typeof type.scopedOverrides === "object"
        ? type.scopedOverrides
        : {},
  };
}

function normalizeSurvey(survey: Survey, projects: Project[] = store.db.projects): Survey {
  const project = survey.projectId
    ? projects.find((entry) => entry.id === survey.projectId)
    : undefined;
  const clientId = survey.clientId || project?.clientId || "";
  const empreendimentoId = survey.empreendimentoId || project?.empreendimentoId;
  const nextModules = { ...(survey.modules ?? {}) };
  const moduleIdsToEnsure = new Set<string>(getModulesForType(survey.type).map((m) => m.id));
  if (survey.customTypeId) {
    const ct = (store.db.customSurveyTypes ?? []).find((c) => c.id === survey.customTypeId);
    ct?.moduleBindings.forEach((b) => moduleIdsToEnsure.add(b.moduleId));
  }
  for (const id of moduleIdsToEnsure) {
    const current = nextModules[id];
    nextModules[id] = current ? normalizeModuleState(current) : createModuleState();
  }
  for (const [id, mod] of Object.entries(nextModules)) {
    nextModules[id] = normalizeModuleState(mod);
  }
  return {
    ...survey,
    clientId,
    empreendimentoId,
    modules: ensureLegacyAdapters(nextModules),
    pendencias: Array.isArray(survey.pendencias) ? survey.pendencias : [],
    signatures: survey.signatures ?? {},
  };
}

function normalizeDB(raw: Partial<DB> | null | undefined): DB {
  const projects = Array.isArray(raw?.projects) ? raw!.projects! : [];
  return {
    clients: Array.isArray(raw?.clients) ? raw!.clients! : [],
    empreendimentos: Array.isArray(raw?.empreendimentos) ? raw!.empreendimentos! : [],
    projects,
    surveys: Array.isArray(raw?.surveys) ? raw!.surveys!.map((s) => normalizeSurvey(s, projects)) : [],
    templates: Array.isArray(raw?.templates) ? raw!.templates! : [],
    formOverrides: (raw?.formOverrides && typeof raw.formOverrides === "object") ? raw.formOverrides as FormStructureOverrides : {},
    customSurveyTypes: Array.isArray(raw?.customSurveyTypes)
      ? raw!.customSurveyTypes!.map((type) => normalizeCustomSurveyType(type))
      : [],
  };
}

const runtimeGlobal = globalThis as typeof globalThis & {
  __ramosStoreRuntime?: StoreRuntime;
};

const store: StoreRuntime = runtimeGlobal.__ramosStoreRuntime ??= {
  db: EMPTY_DB,
  status: { hydrated: typeof window === "undefined", persistPending: false, authed: false },
  listeners: new Set<() => void>(),
  syncChain: Promise.resolve(),
  authBound: false,
  pendingFlush: false,
  lastSyncedDb: EMPTY_DB,
};

function emit() {
  store.listeners.forEach((l) => l());
}

// Coalesce multiple synchronous mutations into a single emit per microtask.
let emitScheduled = false;
function scheduleEmit() {
  if (emitScheduled) return;
  emitScheduled = true;
  queueMicrotask(() => {
    emitScheduled = false;
    emit();
  });
}

// Run heavy IDB snapshot off the critical path.
function idle(cb: () => void) {
  if (typeof window === "undefined") return cb();
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;
  if (ric) ric(cb, { timeout: 2000 });
  else window.setTimeout(cb, 200);
}

function syncGlobalOverrides() {
  setGlobalFormOverrides(store.db.formOverrides);
}

/* =================== Supabase sync =================== */

type TableName = "clients" | "empreendimentos" | "projects" | "surveys" | "survey_templates" | "custom_survey_types";

function rowFor(table: TableName, item: any): Record<string, any> {
  switch (table) {
    case "clients": return { id: item.id, data: item };
    case "empreendimentos": return { id: item.id, client_id: item.clientId, data: item };
    case "projects": return { id: item.id, client_id: item.clientId, empreendimento_id: item.empreendimentoId ?? null, data: item };
    case "surveys": return { id: item.id, project_id: item.projectId ?? `client:${item.clientId ?? "direct"}`, data: item };
    case "survey_templates": return { id: item.id, data: item };
    case "custom_survey_types": return { id: item.id, data: item };
  }
}

async function diffTable<T extends { id: string }>(
  table: TableName,
  before: T[],
  after: T[],
) {
  const beforeMap = new Map(before.map((x) => [x.id, x]));
  const afterMap = new Map(after.map((x) => [x.id, x]));
  const upserts: any[] = [];
  for (const [id, item] of afterMap) {
    const prev = beforeMap.get(id);
    if (prev !== item) upserts.push(rowFor(table, item));
  }
  const deletes: string[] = [];
  for (const id of beforeMap.keys()) if (!afterMap.has(id)) deletes.push(id);
  if (upserts.length) {
    const { error } = await supabase.from(table).upsert(upserts);
    if (error) console.error(`[sync] upsert ${table}`, error);
  }
  if (deletes.length) {
    const { error } = await supabase.from(table).delete().in("id", deletes);
    if (error) console.error(`[sync] delete ${table}`, error);
  }
}

async function flushSync() {
  if (!store.userId) return;
  const before = store.lastSyncedDb;
  const after = store.db;
  store.lastSyncedDb = after;
  try {
    await Promise.all([
      diffTable("clients", before.clients, after.clients),
      diffTable("empreendimentos", before.empreendimentos, after.empreendimentos),
      diffTable("projects", before.projects, after.projects),
      diffTable("surveys", before.surveys, after.surveys),
      diffTable("survey_templates", before.templates, after.templates),
      diffTable("custom_survey_types", before.customSurveyTypes, after.customSurveyTypes),
    ]);
    if (before.formOverrides !== after.formOverrides) {
      const { error } = await supabase.from("form_overrides").upsert({ id: "singleton", data: after.formOverrides as any });
      if (error) console.error("[sync] upsert form_overrides", error);
    }
    store.status = { ...store.status, persistPending: false, persistenceError: undefined };
    if (store.userId) {
      const uid = store.userId;
      idle(() => void saveSnapshot(uid, store.db));
    }
  } catch (err) {
    console.error("[sync] flush failed", err);
    store.status = { ...store.status, persistPending: false, persistenceError: "Falha ao sincronizar com o servidor." };
    if (store.userId) {
      const uid = store.userId;
      idle(() => void saveSnapshot(uid, store.db));
    }
  }
  emit();
}

function queueSync(immediate = false) {
  if (typeof window === "undefined") return;
  if (!store.userId) return;
  store.status = { ...store.status, persistPending: true, persistenceError: undefined };
  emit();
  if (store.syncTimer) {
    window.clearTimeout(store.syncTimer);
    store.syncTimer = undefined;
  }
  const schedule = () => {
    store.syncTimer = undefined;
    store.syncChain = store.syncChain.then(() => flushSync());
  };
  if (immediate) schedule();
  else store.syncTimer = window.setTimeout(schedule, 700);
}

/* =================== Realtime in =================== */

function applyRealtimeChange(table: TableName | "form_overrides", payload: any) {
  const event: "INSERT" | "UPDATE" | "DELETE" = payload.eventType;
  const newRow = payload.new;
  const oldRow = payload.old;
  const next: DB = { ...store.db };

  const upsertItem = <T extends { id: string }>(arr: T[], item: T): T[] => {
    const idx = arr.findIndex((x) => x.id === item.id);
    if (idx === -1) return [item, ...arr];
    const copy = arr.slice();
    copy[idx] = item;
    return copy;
  };
  const removeItem = <T extends { id: string }>(arr: T[], id: string): T[] => arr.filter((x) => x.id !== id);

  if (table === "form_overrides") {
    if (event === "DELETE") next.formOverrides = {};
    else next.formOverrides = (newRow?.data ?? {}) as FormStructureOverrides;
  } else {
    const id = (newRow?.id ?? oldRow?.id) as string;
    const item = newRow?.data;
    const apply = <K extends keyof DB>(key: K) => {
      const arr = next[key] as any[];
      if (event === "DELETE") next[key] = removeItem(arr as any, id) as any;
      else if (item) {
        const value = key === "surveys" ? normalizeSurvey(item) : item;
        next[key] = upsertItem(arr as any, value) as any;
      }
    };
    switch (table) {
      case "clients": apply("clients"); break;
      case "empreendimentos": apply("empreendimentos"); break;
      case "projects": apply("projects"); break;
      case "surveys": apply("surveys"); break;
      case "survey_templates": apply("templates"); break;
      case "custom_survey_types": apply("customSurveyTypes"); break;
    }
  }

  store.db = next;
  store.lastSyncedDb = next; // remote already authoritative
  syncGlobalOverrides();
  emit();
}

function subscribeRealtime() {
  if (store.channel) return;
  const ch = supabase.channel("workspace");
  const tables: (TableName | "form_overrides")[] = [
    "clients", "empreendimentos", "projects", "surveys",
    "survey_templates", "custom_survey_types", "form_overrides",
  ];
  for (const t of tables) {
    ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (payload) => {
      applyRealtimeChange(t, payload);
    });
  }
  ch.subscribe();
  store.channel = ch;
}

function unsubscribeRealtime() {
  if (store.channel) {
    supabase.removeChannel(store.channel);
    store.channel = undefined;
  }
}

/* =================== Initial load =================== */

async function fetchAll(): Promise<DB> {
  const [clients, emp, projects, surveys, templates, custom, fo] = await Promise.all([
    supabase.from("clients").select("data"),
    supabase.from("empreendimentos").select("data"),
    supabase.from("projects").select("data"),
    supabase.from("surveys").select("data"),
    supabase.from("survey_templates").select("data"),
    supabase.from("custom_survey_types").select("data"),
    supabase.from("form_overrides").select("data").eq("id", "singleton").maybeSingle(),
  ]);
  return normalizeDB({
    clients: (clients.data ?? []).map((r: any) => r.data),
    empreendimentos: (emp.data ?? []).map((r: any) => r.data),
    projects: (projects.data ?? []).map((r: any) => r.data),
    surveys: (surveys.data ?? []).map((r: any) => r.data),
    templates: (templates.data ?? []).map((r: any) => r.data),
    customSurveyTypes: (custom.data ?? []).map((r: any) => r.data),
    formOverrides: (fo.data?.data ?? {}) as FormStructureOverrides,
  });
}

async function initForUser(userId: string) {
  store.userId = userId;
  store.status = { ...store.status, hydrated: false, authed: true };
  emit();
  try {
    const loaded = await fetchAll();
    store.db = loaded;
    store.lastSyncedDb = loaded;
    syncGlobalOverrides();
    subscribeRealtime();
    seedBuiltInSurveyTypes();
    void saveSnapshot(userId, store.db);
  } catch (err) {
    console.error("[sync] initial load failed", err);
    // Tenta recuperar do snapshot offline
    const snap = await loadSnapshot(userId);
    if (snap) {
      store.db = normalizeDB(snap as any);
      store.lastSyncedDb = store.db;
      syncGlobalOverrides();
      store.status = { ...store.status, persistenceError: "Modo offline — usando dados locais." };
    } else {
      store.status = { ...store.status, persistenceError: "Falha ao carregar dados do servidor." };
    }
  } finally {
    store.status = { ...store.status, hydrated: true };
    emit();
  }
}

function clearForLogout() {
  store.userId = undefined;
  unsubscribeRealtime();
  store.db = EMPTY_DB;
  store.lastSyncedDb = EMPTY_DB;
  store.status = { ...store.status, hydrated: true, authed: false, persistPending: false, persistenceError: undefined };
  syncGlobalOverrides();
  emit();
}

function bindAuth() {
  if (typeof window === "undefined" || store.authBound) return;
  store.authBound = true;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      void initForUser(session.user.id);
    } else {
      store.status = { ...store.status, hydrated: true, authed: false };
      emit();
    }
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user && session.user.id !== store.userId) {
      void initForUser(session.user.id);
    } else if (!session?.user && store.userId) {
      clearForLogout();
    }
  });
}

bindAuth();

/** Garante que cada tipo embutido exista como CustomSurveyType editável. */
function seedBuiltInSurveyTypes() {
  const list = store.db.customSurveyTypes ?? [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const bySource = new Map(
    list.filter((c) => c.sourceTypeId).map((c) => [c.sourceTypeId as string, c]),
  );
  const additions: CustomSurveyType[] = [];
  for (const tid of BUILTIN_SURVEY_TYPE_IDS) {
    if (byId.has(tid) || bySource.has(tid)) continue;
    const meta = SURVEY_TYPES.find((t) => t.id === tid);
    const modules = getModulesForType(tid);
    const minimal = new Set((MODULE_PRESETS[tid] ?? { minimal: [] }).minimal);
    additions.push({
      id: tid,
      label: meta?.label ?? tid,
      description: meta?.description,
      sourceTypeId: tid,
      icon: DEFAULT_BUILTIN_ICONS[tid],
      moduleBindings: modules.map((m) => ({
        moduleId: m.id,
        requirement: minimal.has(m.id) ? "recomendado" : "opcional",
      })),
      scopedOverrides: {},
      createdAt: new Date().toISOString(),
    });
  }
  if (additions.length) {
    store.db = {
      ...store.db,
      customSurveyTypes: [...additions, ...list],
    };
    persist();
  }
}

function persist() {
  queueSync();
  scheduleEmit();
}

function subscribe(listener: () => void) {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getSnapshot() {
  return store.db;
}

function getServerSnapshot(): DB {
  return EMPTY_DB;
}

function getStatusSnapshot() {
  return store.status;
}

function getServerStatusSnapshot(): DBStatus {
  return { hydrated: false, persistPending: false, authed: false };
}

export function useDB() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useDBStatus() {
  return useSyncExternalStore(subscribe, getStatusSnapshot, getServerStatusSnapshot);
}

export function useDBSelector<T>(selector: (state: DB) => T, isEqual: (a: T, b: T) => boolean = Object.is) {
  const [selected, setSelected] = useState(() => selector(store.db));
  const selectedRef = useRef(selected);
  const selectorRef = useRef(selector);
  const isEqualRef = useRef(isEqual);

  selectorRef.current = selector;
  isEqualRef.current = isEqual;

  useEffect(() => {
    const next = selector(store.db);
    if (!isEqualRef.current(selectedRef.current, next)) {
      selectedRef.current = next;
      setSelected(next);
    }
  }, [selector]);

  useEffect(() => {
    return subscribe(() => {
      const next = selectorRef.current(store.db);
      if (!isEqualRef.current(selectedRef.current, next)) {
        selectedRef.current = next;
        setSelected(next);
      }
    });
  }, []);

  return selected;
}

const id = () => Math.random().toString(36).slice(2, 11);


export function addClient(data: Omit<Client, "id" | "createdAt">) {
  const client: Client = { ...data, id: id(), createdAt: new Date().toISOString() };
  store.db = { ...store.db, clients: [client, ...store.db.clients] };
  persist();
  return client;
}

export function updateClient(cid: string, data: Partial<Client>) {
  store.db = { ...store.db, clients: store.db.clients.map((client) => (client.id === cid ? { ...client, ...data } : client)) };
  persist();
}

export function deleteClient(cid: string) {
  const remainingProjects = store.db.projects.filter((project) => project.clientId !== cid);
  const remainingProjectIds = new Set(remainingProjects.map((project) => project.id));

  store.db = {
    ...store.db,
    clients: store.db.clients.filter((client) => client.id !== cid),
    empreendimentos: store.db.empreendimentos.filter((empreendimento) => empreendimento.clientId !== cid),
    projects: remainingProjects,
    surveys: store.db.surveys.filter((survey) => {
      if (survey.clientId === cid) return false;
      return survey.projectId ? remainingProjectIds.has(survey.projectId) : true;
    }),
  };
  persist();
}

export function addEmpreendimento(data: Omit<Empreendimento, "id" | "createdAt">) {
  const empreendimento: Empreendimento = { ...data, id: id(), createdAt: new Date().toISOString() };
  store.db = { ...store.db, empreendimentos: [empreendimento, ...store.db.empreendimentos] };
  persist();
  return empreendimento;
}

export function updateEmpreendimento(eid: string, data: Partial<Empreendimento>) {
  store.db = {
    ...store.db,
    empreendimentos: store.db.empreendimentos.map((empreendimento) => (empreendimento.id === eid ? { ...empreendimento, ...data } : empreendimento)),
  };
  persist();
}

export function deleteEmpreendimento(eid: string) {
  store.db = {
    ...store.db,
    empreendimentos: store.db.empreendimentos.filter((empreendimento) => empreendimento.id !== eid),
    projects: store.db.projects.map((project) => (project.empreendimentoId === eid ? { ...project, empreendimentoId: undefined } : project)),
    surveys: store.db.surveys.map((survey) => (survey.empreendimentoId === eid ? { ...survey, empreendimentoId: undefined } : survey)),
  };
  persist();
}

export function addProject(data: Omit<Project, "id" | "createdAt">) {
  const project: Project = { ...data, id: id(), createdAt: new Date().toISOString() };
  store.db = { ...store.db, projects: [project, ...store.db.projects] };
  persist();
  return project;
}

export function deleteProject(pid: string) {
  store.db = {
    ...store.db,
    projects: store.db.projects.filter((project) => project.id !== pid),
    surveys: store.db.surveys.map((survey) => (survey.projectId === pid ? { ...survey, projectId: undefined } : survey)),
  };
  persist();
}

export function addSurvey(data: { clientId: string; projectId?: string; empreendimentoId?: string; type: SurveyType; title: string }) {
  return addSurveyExt({ ...data });
}

/** Versão extendida de addSurvey que aceita customTypeId. */
export function addSurveyExt(data: {
  clientId: string;
  projectId?: string;
  empreendimentoId?: string;
  type: SurveyType;
  title: string;
  customTypeId?: string;
}) {
  const project = data.projectId ? store.db.projects.find((entry) => entry.id === data.projectId) : undefined;
  const clientId = data.clientId || project?.clientId;
  if (!clientId) {
    throw new Error("Levantamento precisa estar vinculado a um cliente.");
  }
  const modules: Record<string, ModuleState> = {};
  const moduleIds = new Set<string>();
  getModulesForType(data.type).forEach((m) => moduleIds.add(m.id));
  if (data.customTypeId) {
    const ct = (store.db.customSurveyTypes ?? []).find((c) => c.id === data.customTypeId);
    ct?.moduleBindings.forEach((b) => moduleIds.add(b.moduleId));
  }
  moduleIds.forEach((id) => { modules[id] = createModuleState(); });

  // Pré-preenche data e horário de chegada na Identificação.
  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const hhmm = now.toTimeString().slice(0, 5);
  if (modules["identificacao"]) {
    modules["identificacao"] = {
      ...modules["identificacao"],
      values: {
        ...modules["identificacao"].values,
        data_visita: todayISO,
        hora_chegada: hhmm,
      },
      fieldStatus: {
        ...modules["identificacao"].fieldStatus,
        data_visita: "concluido",
        hora_chegada: "concluido",
      },
      status: "em_andamento",
    };
  }

  const survey: Survey = {
    id: id(),
    clientId,
    projectId: data.projectId,
    empreendimentoId: data.empreendimentoId || project?.empreendimentoId,
    type: data.type,
    title: data.title,
    date: todayISO,
    modules,
    pendencias: [],
    signatures: {},
    createdAt: now.toISOString(),
    customTypeId: data.customTypeId,
  };

  // Para tipos personalizados, define enabledModules a partir dos vínculos.
  if (data.customTypeId) {
    const ct = (store.db.customSurveyTypes ?? []).find((c) => c.id === data.customTypeId);
    if (ct) {
      survey.enabledModules = Array.from(new Set([
        ...ct.moduleBindings.map((b) => b.moduleId),
        "identificacao", "validacao",
      ]));
    }
  }

  // Aplica template padrão do tipo, se houver.
  const def = !data.customTypeId
    ? (store.db.templates ?? []).find((t) => t.type === data.type && t.isDefault)
    : undefined;
  if (def && def.moduleIds.length) {
    survey.enabledModules = Array.from(new Set([...def.moduleIds, "identificacao", "validacao"]));
    // Aplica overrides de subgrupos: marca como N/A subgrupos desabilitados pelo template.
    if (def.subgroupOverrides) {
      for (const [mid, sgIds] of Object.entries(def.subgroupOverrides)) {
        if (!survey.modules[mid]) continue;
        const naSub: Record<string, boolean> = { ...(survey.modules[mid].naSubgroups ?? {}) };
        for (const sg of sgIds) naSub[sg] = true;
        survey.modules[mid] = { ...survey.modules[mid], naSubgroups: naSub };
      }
    }
  }

  store.db = { ...store.db, surveys: [survey, ...store.db.surveys] };
  persist();
  return survey;
}

export function updateSurvey(sid: string, data: Partial<Survey>) {
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((survey) => (survey.id === sid ? normalizeSurvey({ ...survey, ...data }) : survey)),
  };
  persist();
}

export function deleteSurvey(sid: string) {
  store.db = { ...store.db, surveys: store.db.surveys.filter((survey) => survey.id !== sid) };
  persist();
}

/** Exclui múltiplos levantamentos de uma vez (Fase 4). */
export function bulkDeleteSurveys(sids: string[]) {
  if (!sids.length) return;
  const set = new Set(sids);
  store.db = { ...store.db, surveys: store.db.surveys.filter((s) => !set.has(s.id)) };
  persist();
}

/** Define as finalidades (Fase 2) de um levantamento. */
export function setSurveyPurposes(sid: string, purposes: import("./types").SurveyPurpose[]) {
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((s) => (s.id === sid ? { ...s, purposes } : s)),
  };
  persist();
}

export function closeSurvey(sid: string, horaSaida?: string) {
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((s) =>
      s.id === sid ? { ...s, closedAt: new Date().toISOString(), closedAtSaida: horaSaida } : s,
    ),
  };
  persist();
}

/**
 * Encerra o levantamento marcando como "não se aplica" todos os campos
 * que não estão preenchidos e não foram concluídos. Isso garante que o
 * relatório final mostre apenas o que foi efetivamente coletado.
 */
export function closeSurveyWithAutoNA(sid: string, horaSaida?: string) {
  const survey = store.db.surveys.find((s) => s.id === sid);
  if (!survey) return;
  const enabledIds: string[] = survey.enabledModules ?? Object.keys(survey.modules);
  const nextModules: typeof survey.modules = { ...survey.modules };
  for (const mid of enabledIds) {
    const st = nextModules[mid];
    if (!st || st.naModule) continue;
    const values = st.values ?? {};
    const nonApplicable = { ...(st.nonApplicable ?? {}) };
    const fieldStatus = { ...(st.fieldStatus ?? {}) };
    // Visita todos os fieldIds conhecidos em values + fieldStatus + qualquer chave
    const knownFieldIds = new Set<string>([
      ...Object.keys(values),
      ...Object.keys(fieldStatus),
      ...Object.keys(nonApplicable),
    ]);
    for (const fid of knownFieldIds) {
      const raw = values[fid];
      const filled = !(raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0));
      const status = fieldStatus[fid];
      if (!filled && status !== "concluido" && !nonApplicable[fid]) {
        nonApplicable[fid] = true;
        fieldStatus[fid] = "nao_se_aplica";
      }
    }
    nextModules[mid] = { ...st, nonApplicable, fieldStatus };
  }
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((s) =>
      s.id === sid
        ? { ...s, modules: nextModules, closedAt: new Date().toISOString(), closedAtSaida: horaSaida }
        : s,
    ),
  };
  persist();
}

export function reopenSurvey(sid: string) {
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((s) =>
      s.id === sid ? { ...s, closedAt: undefined, closedAtSaida: undefined } : s,
    ),
  };
  persist();
}

export function updateModule(sid: string, modId: string, patch: Partial<ModuleState>) {
  store.db = {
    ...store.db,
    surveys: store.db.surveys.map((survey) =>
      survey.id === sid
        ? {
            ...survey,
            modules: {
              ...survey.modules,
              [modId]: normalizeModuleState({ ...(survey.modules[modId] ?? createModuleState()), ...patch }),
            },
          }
        : survey,
    ),
  };
  persist();
}

export function setFieldValue(sid: string, modId: string, fieldId: string, value: any) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  updateModule(sid, modId, {
    values: { ...moduleState.values, [fieldId]: value },
    status: moduleState.status === "nao_iniciado" ? "em_andamento" : moduleState.status,
  });
}

export function setFieldStatus(sid: string, modId: string, fieldId: string, status: FieldStatus) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  updateModule(sid, modId, { fieldStatus: { ...moduleState.fieldStatus, [fieldId]: status } });
}

export function setFieldNote(sid: string, modId: string, fieldId: string, note: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  const nextNotes = { ...(moduleState.fieldNotes ?? {}) };
  if (note.trim()) nextNotes[fieldId] = note;
  else delete nextNotes[fieldId];
  updateModule(sid, modId, { fieldNotes: nextNotes });
}

export function setFieldNA(sid: string, modId: string, fieldId: string, na: boolean) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  const nextNonApplicable = { ...(moduleState.nonApplicable ?? {}) };
  if (na) nextNonApplicable[fieldId] = true;
  else delete nextNonApplicable[fieldId];

  const nextFieldStatus = { ...moduleState.fieldStatus };
  if (na) nextFieldStatus[fieldId] = "nao_se_aplica";
  else if (nextFieldStatus[fieldId] === "nao_se_aplica") delete nextFieldStatus[fieldId];

  updateModule(sid, modId, { nonApplicable: nextNonApplicable, fieldStatus: nextFieldStatus });
}

export function setEnabledModules(sid: string, ids: string[]) {
  updateSurvey(sid, { enabledModules: ids });
}

export function setModuleNA(sid: string, modId: string, na: boolean) {
  updateModule(sid, modId, { naModule: na });
}

export function setModuleDone(sid: string, modId: string, done: boolean) {
  updateModule(sid, modId, { moduleDone: done });
}

export function setSubgroupDone(sid: string, modId: string, subId: string, done: boolean) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  const next = { ...(moduleState.subgroupDone ?? {}) };
  if (done) next[subId] = true;
  else delete next[subId];
  updateModule(sid, modId, { subgroupDone: next });
}

export function setSubgroupNA(sid: string, modId: string, subId: string, na: boolean) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  const next = { ...(moduleState.naSubgroups ?? {}) };
  if (na) next[subId] = true;
  else delete next[subId];
  updateModule(sid, modId, { naSubgroups: next });
}

export function setSubgroupNote(sid: string, modId: string, subId: string, note: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  const next = { ...(moduleState.subgroupNotes ?? {}) };
  if (note.trim()) next[subId] = note;
  else delete next[subId];
  updateModule(sid, modId, { subgroupNotes: next });
}

export function enableModule(sid: string, modId: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const current = survey.enabledModules ?? [];
  if (current.includes(modId)) return;
  updateSurvey(sid, { enabledModules: [...current, modId] });
}

export function disableModule(sid: string, modId: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const current = survey.enabledModules ?? [];
  updateSurvey(sid, { enabledModules: current.filter((id) => id !== modId) });
}

export function addAttachment(sid: string, modId: string, att: Attachment) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  updateModule(sid, modId, { attachments: [...moduleState.attachments, att] });
}

export function removeAttachment(sid: string, modId: string, attId: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const moduleState = survey.modules[modId];
  updateModule(sid, modId, { attachments: moduleState.attachments.filter((attachment) => attachment.id !== attId) });
}

// ============== Relatório Fotográfico (módulo "fotos") ==============

const PHOTOS_MOD = "fotos";

function getPhotosState(sid: string): ModuleState | undefined {
  const survey = store.db.surveys.find((s) => s.id === sid);
  return survey?.modules[PHOTOS_MOD];
}

export function setPhotoChecklistKeys(sid: string, keys: string[]) {
  const st = getPhotosState(sid);
  if (!st) return;
  updateModule(sid, PHOTOS_MOD, { photoChecklistKeys: Array.from(new Set(keys)) });
}

export function setPhotoAnswer(
  sid: string,
  templateKey: string,
  itemId: string,
  label: string,
  registrado: boolean,
) {
  const st = getPhotosState(sid);
  if (!st) return;
  const composed = `${templateKey}.${itemId}`;
  const list = st.photoChecklist ?? [];
  const now = new Date().toISOString();
  const idx = list.findIndex((a) => a.itemId === composed);
  let next: PhotoChecklistAnswer[];
  if (idx >= 0) {
    next = list.slice();
    next[idx] = { ...next[idx], label, templateKey, registrado, updatedAt: now };
  } else {
    next = [...list, { itemId: composed, label, templateKey, registrado, updatedAt: now }];
  }
  updateModule(sid, PHOTOS_MOD, { photoChecklist: next });
}

export function setPhotoNote(sid: string, composedItemId: string, observacao: string) {
  const st = getPhotosState(sid);
  if (!st) return;
  const list = st.photoChecklist ?? [];
  const idx = list.findIndex((a) => a.itemId === composedItemId);
  if (idx < 0) return;
  const next = list.slice();
  next[idx] = { ...next[idx], observacao, updatedAt: new Date().toISOString() };
  updateModule(sid, PHOTOS_MOD, { photoChecklist: next });
}

export function setPhotoLiberadoDivulgacao(sid: string, value: boolean) {
  const st = getPhotosState(sid);
  if (!st) return;
  updateModule(sid, PHOTOS_MOD, { photoLiberadoDivulgacao: value });
}

export function bulkSetPhotoAnswers(
  sid: string,
  templateKey: string,
  items: { id: string; label: string }[],
  registrado: boolean,
) {
  const st = getPhotosState(sid);
  if (!st) return;
  const list = st.photoChecklist ?? [];
  const now = new Date().toISOString();
  const map = new Map(list.map((a) => [a.itemId, a] as const));
  for (const it of items) {
    const composed = `${templateKey}.${it.id}`;
    const prev = map.get(composed);
    map.set(composed, {
      itemId: composed,
      label: it.label,
      templateKey,
      registrado,
      observacao: prev?.observacao,
      updatedAt: now,
    });
  }
  updateModule(sid, PHOTOS_MOD, { photoChecklist: Array.from(map.values()) });
}

export function addPendencia(sid: string, pendencia: Omit<Pendencia, "id" | "createdAt">) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  const nextPendencia: Pendencia = { ...pendencia, id: id(), createdAt: new Date().toISOString() };
  updateSurvey(sid, { pendencias: [nextPendencia, ...survey.pendencias] });
}

export function removePendencia(sid: string, pid: string) {
  const survey = store.db.surveys.find((entry) => entry.id === sid);
  if (!survey) return;
  updateSurvey(sid, { pendencias: survey.pendencias.filter((pendencia) => pendencia.id !== pid) });
}

// =================== Templates de módulos ===================

export function addTemplate(data: Omit<SurveyTemplate, "id" | "createdAt">) {
  const tpl: SurveyTemplate = { ...data, id: id(), createdAt: new Date().toISOString() };
  store.db = { ...store.db, templates: [tpl, ...(store.db.templates ?? [])] };
  persist();
  return tpl;
}

export function updateTemplate(tid: string, patch: Partial<Omit<SurveyTemplate, "id" | "createdAt">>) {
  store.db = {
    ...store.db,
    templates: (store.db.templates ?? []).map((t) => (t.id === tid ? { ...t, ...patch } : t)),
  };
  persist();
}

export function removeTemplate(tid: string) {
  store.db = { ...store.db, templates: (store.db.templates ?? []).filter((t) => t.id !== tid) };
  persist();
}

export function setTemplateDefault(tid: string, isDefault: boolean) {
  const list = store.db.templates ?? [];
  const target = list.find((x) => x.id === tid);
  if (!target) return;
  store.db = {
    ...store.db,
    templates: list.map((t) => {
      if (t.id === tid) return { ...t, isDefault };
      if (isDefault && t.type === target.type) return { ...t, isDefault: false };
      return t;
    }),
  };
  persist();
}

export function duplicateTemplate(tid: string) {
  const list = store.db.templates ?? [];
  const target = list.find((t) => t.id === tid);
  if (!target) return;
  const copy: SurveyTemplate = {
    ...target,
    id: id(),
    name: `${target.name} (cópia)`,
    isDefault: false,
    createdAt: new Date().toISOString(),
    subgroupOverrides: target.subgroupOverrides
      ? Object.fromEntries(Object.entries(target.subgroupOverrides).map(([k, v]) => [k, [...v]]))
      : undefined,
    moduleIds: [...target.moduleIds],
  };
  store.db = { ...store.db, templates: [copy, ...list] };
  persist();
  return copy;
}

/* =================== Estrutura dos Formulários =================== */

function mutateOverrides(fn: (o: FormStructureOverrides) => FormStructureOverrides) {
  const current = store.db.formOverrides ?? {};
  store.db = { ...store.db, formOverrides: fn(current) };
  syncGlobalOverrides();
  persist();
}

export function setModulePatch(moduleId: string, patch: ModulePatch | null) {
  mutateOverrides((o) => {
    const next = { ...(o.modules ?? {}) };
    if (!patch) delete next[moduleId]; else next[moduleId] = { ...(next[moduleId] ?? {}), ...patch };
    return { ...o, modules: next };
  });
}

export function setSubgroupPatch(moduleId: string, subgroupId: string, patch: SubgroupPatch | null) {
  const key = `${moduleId}.${subgroupId}`;
  mutateOverrides((o) => {
    const next = { ...(o.subgroups ?? {}) };
    if (!patch) delete next[key]; else next[key] = { ...(next[key] ?? {}), ...patch };
    return { ...o, subgroups: next };
  });
}

export function setFieldPatch(
  moduleId: string, subgroupId: string | null, fieldId: string, patch: FieldPatch | null,
) {
  const key = `${moduleId}.${subgroupId ?? "_"}.${fieldId}`;
  mutateOverrides((o) => {
    const next = { ...(o.fields ?? {}) };
    if (!patch) delete next[key]; else next[key] = { ...(next[key] ?? {}), ...patch };
    return { ...o, fields: next };
  });
}

export function addCustomSubgroup(moduleId: string, subgroup: SubgroupDef) {
  mutateOverrides((o) => {
    const next = { ...(o.customSubgroups ?? {}) };
    next[moduleId] = [...(next[moduleId] ?? []), subgroup];
    return { ...o, customSubgroups: next };
  });
}

export function removeCustomSubgroup(moduleId: string, subgroupId: string) {
  mutateOverrides((o) => {
    const next = { ...(o.customSubgroups ?? {}) };
    if (next[moduleId]) {
      next[moduleId] = next[moduleId].filter((s) => s.id !== subgroupId);
      if (!next[moduleId].length) delete next[moduleId];
    }
    return { ...o, customSubgroups: next };
  });
}

export function addCustomField(moduleId: string, subgroupId: string, field: FieldDef) {
  const key = `${moduleId}.${subgroupId}`;
  mutateOverrides((o) => {
    const next = { ...(o.customFields ?? {}) };
    next[key] = [...(next[key] ?? []), field];
    return { ...o, customFields: next };
  });
}

export function removeCustomField(moduleId: string, subgroupId: string, fieldId: string) {
  const key = `${moduleId}.${subgroupId}`;
  mutateOverrides((o) => {
    const next = { ...(o.customFields ?? {}) };
    if (next[key]) {
      next[key] = next[key].filter((f) => f.id !== fieldId);
      if (!next[key].length) delete next[key];
    }
    return { ...o, customFields: next };
  });
}

export function resetAllFormOverrides() {
  store.db = { ...store.db, formOverrides: {} };
  persist();
}

/** Hook: retorna módulos do tipo já com overrides aplicados. */
export function useEffectiveModulesForType(type: SurveyType) {
  const overrides = useDBSelector(
    (s) => s.formOverrides ?? {},
    (a, b) => a === b,
  );
  return getEffectiveModulesForType(type, overrides);
}

/* =================== Tipos de Levantamento Personalizados =================== */

function genTypeId() {
  return `custom_${Math.random().toString(36).slice(2, 9)}`;
}

export function useCustomSurveyTypes(): CustomSurveyType[] {
  return useDBSelector((s) => s.customSurveyTypes ?? [], (a, b) => a === b);
}

export function getSurveyTypeMeta(typeId: SurveyType, customTypeId?: string) {
  const custom = customTypeId
    ? (store.db.customSurveyTypes ?? []).find((c) => c.id === customTypeId)
    : undefined;
  if (custom) {
    return {
      id: custom.id,
      label: custom.label,
      description: custom.description,
      color: custom.color,
      icon: custom.icon,
      sourceTypeId: custom.sourceTypeId,
      isCustom: true,
    };
  }

  const builtIn = SURVEY_TYPES.find((t) => t.id === typeId);
  return {
    id: typeId,
    label: builtIn?.label ?? typeId,
    description: builtIn?.description,
    color: undefined,
    icon: undefined,
    sourceTypeId: builtIn?.id,
    isCustom: false,
  };
}

export function useSurveyTypeMeta(typeId: SurveyType, customTypeId?: string) {
  return useDBSelector(
    () => getSurveyTypeMeta(typeId, customTypeId),
    (a, b) =>
      a.id === b.id
      && a.label === b.label
      && a.description === b.description
      && a.color === b.color
      && a.icon === b.icon
      && a.sourceTypeId === b.sourceTypeId
      && a.isCustom === b.isCustom,
  );
}

export function ensureEditableSurveyType(typeId: SurveyType): CustomSurveyType {
  const existing = getCustomSurveyType(typeId)
    ?? (store.db.customSurveyTypes ?? []).find((c) => c.sourceTypeId === typeId);
  if (existing) return existing;

  const builtInMeta = {
    geral: {
      label: "Levantamento Geral de Projetos",
      description: "Coleta ampla de dados de empresa, atividade, água, resíduos, efluentes e processo.",
    },
    ambiental: {
      label: "Acompanhamento Ambiental",
      description: "Controle periódico de conformidade, ETE, resíduos, documentos e pendências.",
    },
    vazao: {
      label: "Medição de Vazão",
      description: "Registro técnico de seção, profundidades, tempos e desenho.",
    },
    outorga: {
      label: "Outorga",
      description: "Coleta para processo de outorga: poço, bomba, reservatório e representante legal.",
    },
    terreno: {
      label: "Visita ao Local / Terreno",
      description: "Caracterização física: limites, topografia, vegetação, solo, acesso e vizinhança.",
    },
  }[typeId] ?? { label: typeId, description: undefined };

  const modules = getModulesForType(typeId);
  const minimal = new Set((MODULE_PRESETS[typeId] ?? { minimal: [] }).minimal);
  return createSurveyTypeFromBase({
    label: builtInMeta.label,
    description: builtInMeta.description,
    sourceTypeId: typeId,
    moduleBindings: modules.map((m) => ({
      moduleId: m.id,
      requirement: minimal.has(m.id) ? "recomendado" : "opcional",
    })),
    scopedOverrides: {},
  });
}

export function getCustomSurveyType(id: string): CustomSurveyType | undefined {
  return (store.db.customSurveyTypes ?? []).find((c) => c.id === id);
}

export function createCustomSurveyType(data: { label?: string; description?: string; color?: string; icon?: string } = {}) {
  const ct: CustomSurveyType = {
    id: genTypeId(),
    label: data.label?.trim() || "Novo tipo de levantamento",
    description: data.description,
    color: data.color,
    icon: data.icon,
    moduleBindings: [
      { moduleId: "identificacao", requirement: "obrigatorio" },
      { moduleId: "validacao", requirement: "obrigatorio" },
    ],
    scopedOverrides: {},
    createdAt: new Date().toISOString(),
  };
  store.db = { ...store.db, customSurveyTypes: [ct, ...(store.db.customSurveyTypes ?? [])] };
  persist();
  return ct;
}

export function createSurveyTypeFromBase(data: {
  label: string;
  description?: string;
  sourceTypeId?: SurveyType;
  color?: string;
  icon?: string;
  moduleBindings: CustomTypeModuleBinding[];
  scopedOverrides?: FormStructureOverrides;
}) {
  const ct: CustomSurveyType = {
    id: genTypeId(),
    label: data.label.trim() || "Novo tipo de levantamento",
    description: data.description,
    sourceTypeId: data.sourceTypeId,
    color: data.color,
    icon: data.icon,
    moduleBindings: data.moduleBindings.map((binding) => ({ ...binding })),
    scopedOverrides: data.scopedOverrides ? JSON.parse(JSON.stringify(data.scopedOverrides)) : {},
    createdAt: new Date().toISOString(),
  };
  store.db = { ...store.db, customSurveyTypes: [ct, ...(store.db.customSurveyTypes ?? [])] };
  persist();
  return ct;
}

export function updateCustomSurveyType(id: string, patch: Partial<Omit<CustomSurveyType, "id" | "createdAt">>) {
  store.db = {
    ...store.db,
    customSurveyTypes: (store.db.customSurveyTypes ?? []).map((c) => c.id === id ? { ...c, ...patch } : c),
  };
  persist();
}

export function deleteCustomSurveyType(id: string) {
  // Se houver levantamentos vinculados, marca como arquivado.
  const inUse = store.db.surveys.some((s) => s.customTypeId === id);
  if (inUse) {
    updateCustomSurveyType(id, { archivedAt: new Date().toISOString() });
    return;
  }
  store.db = {
    ...store.db,
    customSurveyTypes: (store.db.customSurveyTypes ?? []).filter((c) => c.id !== id),
  };
  persist();
}

export function duplicateCustomSurveyType(id: string) {
  const src = getCustomSurveyType(id);
  if (!src) return;
  const copy: CustomSurveyType = {
    ...src,
    id: genTypeId(),
    label: `${src.label} (cópia)`,
    sourceTypeId: undefined,
    moduleBindings: src.moduleBindings.map((b) => ({ ...b })),
    scopedOverrides: src.scopedOverrides ? JSON.parse(JSON.stringify(src.scopedOverrides)) : {},
    archivedAt: undefined,
    createdAt: new Date().toISOString(),
  };
  store.db = { ...store.db, customSurveyTypes: [copy, ...(store.db.customSurveyTypes ?? [])] };
  persist();
  return copy;
}

/** Aplica um patch parcial ao escopo do tipo personalizado. */
function mutateScoped(typeId: string, fn: (o: FormStructureOverrides) => FormStructureOverrides) {
  const list = store.db.customSurveyTypes ?? [];
  const target = list.find((c) => c.id === typeId);
  if (!target) return;
  const next = fn(target.scopedOverrides ?? {});
  store.db = {
    ...store.db,
    customSurveyTypes: list.map((c) => c.id === typeId ? { ...c, scopedOverrides: next } : c),
  };
  persist();
}

export function setTypeModulePatch(typeId: string, moduleId: string, patch: ModulePatch | null) {
  mutateScoped(typeId, (o) => {
    const next = { ...(o.modules ?? {}) };
    if (!patch) delete next[moduleId]; else next[moduleId] = { ...(next[moduleId] ?? {}), ...patch };
    return { ...o, modules: next };
  });
}

export function setTypeSubgroupPatch(typeId: string, moduleId: string, subgroupId: string, patch: SubgroupPatch | null) {
  const key = `${moduleId}.${subgroupId}`;
  mutateScoped(typeId, (o) => {
    const next = { ...(o.subgroups ?? {}) };
    if (!patch) delete next[key]; else next[key] = { ...(next[key] ?? {}), ...patch };
    return { ...o, subgroups: next };
  });
}

export function setTypeFieldPatch(typeId: string, moduleId: string, subgroupId: string | null, fieldId: string, patch: FieldPatch | null) {
  const key = `${moduleId}.${subgroupId ?? "_"}.${fieldId}`;
  mutateScoped(typeId, (o) => {
    const next = { ...(o.fields ?? {}) };
    if (!patch) delete next[key]; else next[key] = { ...(next[key] ?? {}), ...patch };
    return { ...o, fields: next };
  });
}

export function addTypeCustomSubgroup(typeId: string, moduleId: string, subgroup: SubgroupDef) {
  mutateScoped(typeId, (o) => {
    const next = { ...(o.customSubgroups ?? {}) };
    next[moduleId] = [...(next[moduleId] ?? []), subgroup];
    return { ...o, customSubgroups: next };
  });
}

export function removeTypeCustomSubgroup(typeId: string, moduleId: string, subgroupId: string) {
  mutateScoped(typeId, (o) => {
    const next = { ...(o.customSubgroups ?? {}) };
    if (next[moduleId]) {
      next[moduleId] = next[moduleId].filter((s) => s.id !== subgroupId);
      if (!next[moduleId].length) delete next[moduleId];
    }
    return { ...o, customSubgroups: next };
  });
}

export function addTypeCustomField(typeId: string, moduleId: string, subgroupId: string, field: FieldDef) {
  const key = `${moduleId}.${subgroupId}`;
  mutateScoped(typeId, (o) => {
    const next = { ...(o.customFields ?? {}) };
    next[key] = [...(next[key] ?? []), field];
    return { ...o, customFields: next };
  });
}

export function removeTypeCustomField(typeId: string, moduleId: string, subgroupId: string, fieldId: string) {
  const key = `${moduleId}.${subgroupId}`;
  mutateScoped(typeId, (o) => {
    const next = { ...(o.customFields ?? {}) };
    if (next[key]) {
      next[key] = next[key].filter((f) => f.id !== fieldId);
      if (!next[key].length) delete next[key];
    }
    return { ...o, customFields: next };
  });
}

/** Define cor de uma entidade. scope = "global" usa formOverrides; senão usa scoped do tipo. */
export function setEntityColor(scope: "global" | string, key: string, color: string | null) {
  if (scope === "global") {
    mutateOverrides((o) => {
      const next = { ...(o.colors ?? {}) };
      if (!color) delete next[key]; else next[key] = color;
      return { ...o, colors: next };
    });
  } else {
    mutateScoped(scope, (o) => {
      const next = { ...(o.colors ?? {}) };
      if (!color) delete next[key]; else next[key] = color;
      return { ...o, colors: next };
    });
  }
}

/** Atualiza vínculos de módulo de um tipo personalizado. */
export function setTypeModuleBindings(typeId: string, bindings: CustomTypeModuleBinding[]) {
  updateCustomSurveyType(typeId, { moduleBindings: bindings });
}

export function addTypeModule(typeId: string, moduleId: string, requirement: ModuleRequirement = "opcional") {
  const ct = getCustomSurveyType(typeId);
  if (!ct) return;
  if (ct.moduleBindings.some((b) => b.moduleId === moduleId)) return;
  setTypeModuleBindings(typeId, [...ct.moduleBindings, { moduleId, requirement }]);
}

export function removeTypeModule(typeId: string, moduleId: string) {
  const ct = getCustomSurveyType(typeId);
  if (!ct) return;
  setTypeModuleBindings(typeId, ct.moduleBindings.filter((b) => b.moduleId !== moduleId));
}

export function moveTypeModule(typeId: string, moduleId: string, dir: -1 | 1) {
  const ct = getCustomSurveyType(typeId);
  if (!ct) return;
  const idx = ct.moduleBindings.findIndex((b) => b.moduleId === moduleId);
  const next = ct.moduleBindings.slice();
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= next.length) return;
  [next[idx], next[target]] = [next[target], next[idx]];
  setTypeModuleBindings(typeId, next);
}

/** Hook: módulos efetivos para um levantamento (resolve builtin e custom). */
export function useEffectiveModulesForSurvey(survey: Survey) {
  const overrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);
  const customTypes = useDBSelector((s) => s.customSurveyTypes ?? [], (a, b) => a === b);
  if (survey.customTypeId) {
    const ct = customTypes.find((c) => c.id === survey.customTypeId);
    if (ct) return getEffectiveModulesForCustomType(ct, overrides);
  }
  return getEffectiveModulesForType(survey.type, overrides);
}

/** Hook: módulos efetivos para um tipo personalizado (para o construtor). */
export function useEffectiveModulesForCustomTypeId(typeId: string) {
  const overrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);
  const ct = useDBSelector(
    (s) => (s.customSurveyTypes ?? []).find((c) => c.id === typeId),
    (a, b) => a === b,
  );
  if (!ct) return [];
  return getEffectiveModulesForCustomType(ct, overrides);
}
