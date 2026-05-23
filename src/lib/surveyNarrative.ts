import type { ModuleDef, ModuleState, Survey, SubgroupDef, FieldDef, Client } from "./types";
import { SURVEY_PURPOSE_LABELS } from "./types";
import { computeModuleStatus, computeSubgroupStatus, shouldShowField, subgroupProgress } from "./modules";

function fieldHasValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.preset === "string" && o.preset) return true;
    if (Array.isArray(o.turnos) && (o.turnos as unknown[]).length > 0) return true;
    return Object.values(o).some((x) => x !== "" && x != null);
  }
  return true;
}

export interface ModuleSummary {
  module: ModuleDef;
  state: ModuleState;
  status: ReturnType<typeof computeModuleStatus>;
  filled: number;
  total: number;
  pendingFields: FieldDef[];
  missingFields: FieldDef[];
  subgroups: Array<{
    sg: SubgroupDef;
    filled: number;
    total: number;
    status: ReturnType<typeof computeSubgroupStatus>;
    missing: FieldDef[];
  }>;
}

export function summarizeModule(m: ModuleDef, state: ModuleState): ModuleSummary {
  const status = computeModuleStatus(m, state);
  const visibleTop = m.fields.filter((f) => shouldShowField(f, state.values));
  let filled = 0;
  let total = 0;
  const missing: FieldDef[] = [];
  const pending: FieldDef[] = [];

  for (const f of visibleTop) {
    total++;
    if (state.nonApplicable?.[f.id]) { filled++; continue; }
    if (fieldHasValue(state.values[f.id])) filled++;
    else missing.push(f);
    const fs = state.fieldStatus?.[f.id];
    if (fs && fs !== "concluido" && fs !== "nao_iniciado" && fs !== "em_andamento" && fs !== "nao_se_aplica") pending.push(f);
  }

  const subgroups: ModuleSummary["subgroups"] = [];
  for (const sg of m.subgroups ?? []) {
    if (state.naSubgroups?.[sg.id]) continue;
    const prog = subgroupProgress(sg, state);
    const sgStatus = computeSubgroupStatus(sg, state);
    const visible = sg.fields.filter((f) => shouldShowField(f, state.values));
    const sgMissing: FieldDef[] = [];
    for (const f of visible) {
      if (state.nonApplicable?.[f.id]) continue;
      if (!fieldHasValue(state.values[f.id])) sgMissing.push(f);
      const fs = state.fieldStatus?.[f.id];
      if (fs && fs !== "concluido" && fs !== "nao_iniciado" && fs !== "em_andamento" && fs !== "nao_se_aplica") pending.push(f);
    }
    subgroups.push({ sg, filled: prog.filled, total: prog.total, status: sgStatus, missing: sgMissing });
    filled += prog.filled;
    total += prog.total;
  }

  return { module: m, state, status, filled, total, pendingFields: pending, missingFields: missing, subgroups };
}

export interface SurveyOverview {
  modules: ModuleSummary[];
  totalFields: number;
  filledFields: number;
  modulesDone: number;
  modulesInProgress: number;
  modulesPending: number;
  modulesNa: number;
  modulesNotStarted: number;
  totalAttachments: number;
  photoCount: number;
  docCount: number;
  audioCount: number;
  openPendencias: number;
  lastUpdate: string | null;
  progress: number; // 0..1
}

export function buildOverview(survey: Survey, modules: ModuleDef[]): SurveyOverview {
  const summaries = modules.map((m) => summarizeModule(m, survey.modules[m.id] as ModuleState));
  let totalFields = 0;
  let filledFields = 0;
  let modulesDone = 0;
  let modulesInProgress = 0;
  let modulesPending = 0;
  let modulesNa = 0;
  let modulesNotStarted = 0;
  let totalAttachments = 0;
  let photoCount = 0;
  let docCount = 0;
  let audioCount = 0;
  let lastUpdate: string | null = null;
  for (const s of summaries) {
    totalFields += s.total;
    filledFields += s.filled;
    if (s.status === "concluido") modulesDone++;
    else if (s.status === "em_andamento") modulesInProgress++;
    else if (s.status === "pendente" || s.status === "aguardando_documento" || s.status === "aguardando_empresa" || s.status === "requer_retorno") modulesPending++;
    else if (s.status === "nao_se_aplica") modulesNa++;
    else modulesNotStarted++;
    for (const att of s.state?.attachments ?? []) {
      totalAttachments++;
      if (att.type?.startsWith("image/")) photoCount++;
      else if (att.type?.startsWith("audio/")) audioCount++;
      else docCount++;
      if (att.createdAt && (!lastUpdate || att.createdAt > lastUpdate)) lastUpdate = att.createdAt;
    }
  }
  const openPendencias = (survey.pendencias ?? []).filter((p) => p.status !== "concluido").length;
  const progress = totalFields ? filledFields / totalFields : 0;
  return {
    modules: summaries,
    totalFields, filledFields,
    modulesDone, modulesInProgress, modulesPending, modulesNa, modulesNotStarted,
    totalAttachments, photoCount, docCount, audioCount,
    openPendencias, lastUpdate, progress,
  };
}

function listFmt(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function fmtDate(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-BR");
  } catch { return d; }
}

export function buildNarrative(
  survey: Survey,
  overview: SurveyOverview,
  client: Client | null,
  typeLabel: string,
): string {
  const parts: string[] = [];
  const purposeLabels = (survey.purposes ?? []).map((p) => SURVEY_PURPOSE_LABELS[p]).filter(Boolean);
  const clientName = client?.name ?? "cliente não identificado";
  if (purposeLabels.length) {
    parts.push(`O levantamento realizado para o cliente ${clientName} possui finalidade vinculada a ${listFmt(purposeLabels)}, no escopo de ${typeLabel.toLowerCase()}.`);
  } else {
    parts.push(`O levantamento realizado para o cliente ${clientName} está no escopo de ${typeLabel.toLowerCase()} e ainda não tem finalidade definida.`);
  }

  const dataVisita = (survey.modules?.identificacao?.values as any)?.data_visita ?? survey.date;
  const dataLabel = fmtDate(dataVisita);
  const responsavel = survey.responsavel || survey.realizadoPor;
  const statusFrag = survey.closedAt
    ? `encontra-se encerrado em ${fmtDate(survey.closedAt)}`
    : `encontra-se em andamento`;
  const respFrag = responsavel ? ` sob responsabilidade de ${responsavel}` : "";
  if (dataLabel) {
    parts.push(`A visita foi registrada em ${dataLabel} e ${statusFrag}${respFrag}.`);
  } else {
    parts.push(`A visita ${statusFrag}${respFrag}.`);
  }

  const incomplete = overview.modules.filter((m) => m.status === "em_andamento" || m.status === "nao_iniciado");
  if (incomplete.length) {
    const names = incomplete.slice(0, 3).map((m) => m.module.title.toLowerCase());
    parts.push(`Há ${incomplete.length} módulo(s) com preenchimento parcial — destaque para ${listFmt(names)}, que ainda demandam complementação.`);
  } else if (overview.modulesDone > 0) {
    parts.push(`Todos os ${overview.modulesDone} módulos habilitados estão com preenchimento concluído.`);
  }

  const anexFrag: string[] = [];
  if (overview.docCount) anexFrag.push(`${overview.docCount} documento(s)`);
  if (overview.photoCount) anexFrag.push(`${overview.photoCount} foto(s)`);
  if (overview.audioCount) anexFrag.push(`${overview.audioCount} áudio(s)`);
  if (anexFrag.length) parts.push(`Anexos do levantamento: ${listFmt(anexFrag)}.`);
  if (overview.openPendencias > 0) {
    parts.push(`Constam ${overview.openPendencias} pendência(s) em aberto que requerem tratativa antes do encerramento.`);
  } else if (survey.closedAt) {
    parts.push(`Não há pendências abertas neste levantamento.`);
  }

  return parts.join(" ");
}