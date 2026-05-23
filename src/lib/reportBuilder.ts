import type {
  Survey, ModuleDef, ModuleState, FieldDef, SubgroupDef, Client, Pendencia, Attachment,
  Person, HoursValue, SurveyPurpose,
} from "./types";
import { SURVEY_PURPOSE_LABELS, STATUS_LABELS } from "./types";
import { computeModuleStatus, computeSubgroupStatus, shouldShowField, subgroupProgress } from "./modules";
import { summarizeModule } from "./surveyNarrative";

/** Linha de tabela do relatório. */
export interface ReportRow {
  fieldId: string;
  label: string;
  value: string;       // valor formatado para exibição/exportação
  filled: boolean;     // false => mostrar “—” + “Preencher agora”
  status?: string;     // STATUS_LABELS
  note?: string;       // observação do campo
  /** Para repeaters: subtabelas opcionais (cada item vira mini-tabela). */
  subRows?: Array<{ title: string; rows: ReportRow[] }>;
}

export interface ReportSubgroup {
  id: string;
  title: string;
  description?: string;
  status: string;          // STATUS_LABELS
  filled: number;
  total: number;
  rows: ReportRow[];
  note?: string;
}

export interface ReportModule {
  id: string;
  title: string;
  description?: string;
  status: string;          // STATUS_LABELS
  filled: number;
  total: number;
  paragraph: string;       // texto introdutório gerado por heurística
  topRows: ReportRow[];    // campos do nível raiz do módulo
  subgroups: ReportSubgroup[];
  pendencias: Pendencia[];
  attachments: Attachment[];
  notes?: string;          // notes do módulo
  fieldNotes?: Record<string, string>;
}

export interface SurveyReport {
  /** Cabeçalho. */
  header: {
    title: string;
    clientName: string;
    projectName?: string;
    typeLabel: string;
    purposes: string[];     // labels
    statusLabel: string;    // “Em andamento” / “Encerrado em …”
    date?: string;
    closedAt?: string;
    responsavel?: string;
    realizadoPor?: string;
    counters: {
      modules: number;
      filledFields: number;
      totalFields: number;
      pendencias: number;
      photos: number;
      docs: number;
      audios: number;
    };
  };
  executiveSummary: string;
  purposeSection: string;
  clientSection?: { paragraph: string; rows: ReportRow[] };
  visitSection?: { paragraph: string; rows: ReportRow[] };
  modules: ReportModule[];
  pendencias: { paragraph: string; items: Pendencia[] };
  attachments: {
    photos: Array<{ moduleId: string; moduleTitle: string; att: Attachment }>;
    docs: Array<{ moduleId: string; moduleTitle: string; att: Attachment }>;
    audios: Array<{ moduleId: string; moduleTitle: string; att: Attachment }>;
  };
  observations: Array<{ moduleId: string; moduleTitle: string; text: string; scope: string }>;
  closing: { paragraph: string; closed: boolean; closedAt?: string; openPendencias: number };
}

/* ============== formatadores de valor por tipo ============== */

function fmtDate(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-BR");
  } catch { return d; }
}

function fmtDateTime(d?: string): string {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleString("pt-BR");
  } catch { return d; }
}

function isFilled(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const o = v as any;
    if (typeof o.preset === "string" && o.preset) return true;
    if (Array.isArray(o.turnos) && o.turnos.length > 0) return true;
    return Object.values(o).some((x) => x !== "" && x != null);
  }
  return true;
}

export function formatFieldValue(field: FieldDef, value: unknown): string {
  if (!isFilled(value)) return "";
  switch (field.type) {
    case "boolean": return value ? "Sim" : "Não";
    case "date": return fmtDate(String(value));
    case "multiselect":
      return Array.isArray(value) ? (value as string[]).join(", ") : String(value);
    case "number":
    case "quantity": {
      const num = typeof value === "object" ? (value as any).value : value;
      const unit = typeof value === "object" ? (value as any).unit ?? field.unit : field.unit;
      return unit ? `${num} ${unit}` : String(num);
    }
    case "coords": {
      const o = value as any;
      const lat = o.lat ?? o.latitude;
      const lng = o.lng ?? o.longitude;
      if (lat == null && lng == null) return "";
      return `lat ${lat ?? "?"}, lng ${lng ?? "?"}`;
    }
    case "geometries": {
      const arr = Array.isArray(value) ? value : [];
      if (!arr.length) return "";
      const types: Record<string, number> = {};
      for (const g of arr) {
        const t = (g as any)?.type ?? "geom";
        types[t] = (types[t] ?? 0) + 1;
      }
      return Object.entries(types).map(([t, n]) => `${n} ${t}`).join(", ");
    }
    case "people": {
      const arr = (value as Person[]) ?? [];
      if (!arr.length) return "";
      return arr.map((p) => [p.nome, p.cargo, p.telefone].filter(Boolean).join(" — ")).join("; ");
    }
    case "hours-presets": {
      const o = value as HoursValue;
      const parts: string[] = [];
      if (o.preset) parts.push(o.preset);
      if (o.dias?.length) parts.push(o.dias.join("/"));
      if (o.turnos?.length) parts.push(o.turnos.map((t) => `${t.label ?? "turno"} ${t.inicio}-${t.fim}`).join("; "));
      if (o.observacao) parts.push(o.observacao);
      return parts.join(" · ");
    }
    case "apply-to-sides": {
      const o = value as Record<string, unknown>;
      return Object.entries(o)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${k}: ${v}`).join("; ");
    }
    case "repeater": {
      const arr = Array.isArray(value) ? value : [];
      if (!arr.length) return "";
      return `${arr.length} item(s)`;
    }
    case "photo":
    case "document":
    case "audio":
    case "drawing":
    case "signature":
      return Array.isArray(value) ? `${(value as unknown[]).length} arquivo(s)` : "anexado";
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

function buildRow(field: FieldDef, state: ModuleState): ReportRow {
  const raw = state.values?.[field.id];
  const filled = isFilled(raw);
  const fs = state.fieldStatus?.[field.id];
  const value = filled ? formatFieldValue(field, raw) : "";
  const row: ReportRow = {
    fieldId: field.id,
    label: field.label,
    value,
    filled,
    status: fs ? STATUS_LABELS[fs] : undefined,
    note: state.fieldNotes?.[field.id],
  };
  // Repeater: explode em subtabelas
  if (field.type === "repeater" && Array.isArray(raw) && (field.itemFields?.length ?? 0) > 0) {
    row.subRows = raw.map((item: any, idx: number) => {
      const titleField = field.itemFields![0];
      const head = item?.[titleField.id] ? String(item[titleField.id]) : `Item ${idx + 1}`;
      const rows: ReportRow[] = field.itemFields!.map((sub) => ({
        fieldId: `${field.id}.${idx}.${sub.id}`,
        label: sub.label,
        value: isFilled(item?.[sub.id]) ? formatFieldValue(sub, item[sub.id]) : "",
        filled: isFilled(item?.[sub.id]),
      }));
      return { title: head, rows };
    });
  }
  return row;
}

function moduleParagraph(m: ModuleDef, state: ModuleState, filled: number, total: number): string {
  if (state?.naModule) return `O módulo "${m.title}" foi marcado como não aplicável a este levantamento.`;
  if (total === 0) return `O módulo "${m.title}" não possui campos exigíveis no escopo deste levantamento.`;
  const pct = Math.round((filled / total) * 100);
  if (filled === 0) {
    return `O módulo "${m.title}" ainda não recebeu informações; ${total} campo(s) aguardam preenchimento.`;
  }
  if (filled === total) {
    return `O módulo "${m.title}" está totalmente preenchido (${filled}/${total} campos), permitindo uma leitura completa do tópico.`;
  }
  const incomplete = (m.subgroups ?? [])
    .filter((sg) => !state.naSubgroups?.[sg.id])
    .map((sg) => ({ sg, p: subgroupProgress(sg, state) }))
    .filter(({ p }) => p.total > 0 && p.filled < p.total)
    .slice(0, 2)
    .map(({ sg, p }) => `${sg.title.toLowerCase()} (${p.filled}/${p.total})`);
  const tail = incomplete.length ? ` Faltam dados em ${incomplete.join(" e ")}.` : "";
  return `O módulo "${m.title}" está ${pct}% preenchido (${filled}/${total} campos).${tail}`;
}

function statusLabelOf(status: string | undefined): string {
  if (!status) return STATUS_LABELS.nao_iniciado;
  return (STATUS_LABELS as any)[status] ?? status;
}

/* ============== build principal ============== */

export function buildReport(
  survey: Survey,
  modules: ModuleDef[],
  client: Client | null,
  typeLabel: string,
  projectName?: string,
): SurveyReport {
  const purposeLabels = (survey.purposes ?? []).map((p) => SURVEY_PURPOSE_LABELS[p as SurveyPurpose]).filter(Boolean);
  const moduleReports: ReportModule[] = [];
  let totalFields = 0;
  let filledFields = 0;
  let photos = 0;
  let docs = 0;
  let audios = 0;
  const photoList: SurveyReport["attachments"]["photos"] = [];
  const docList: SurveyReport["attachments"]["docs"] = [];
  const audioList: SurveyReport["attachments"]["audios"] = [];
  const observations: SurveyReport["observations"] = [];

  for (const m of modules) {
    const state = (survey.modules?.[m.id] ?? { status: "nao_iniciado", values: {}, fieldStatus: {}, attachments: [] }) as ModuleState;
    // Módulos marcados como N/A não aparecem no relatório
    if (state.naModule) continue;
    const summary = summarizeModule(m, state);
    totalFields += summary.total;
    filledFields += summary.filled;

    const visibleTop = m.fields.filter((f) => shouldShowField(f, state.values));
    // Só linhas preenchidas (omite vazios e N/A)
    const topRows = visibleTop
      .filter((f) => !state.nonApplicable?.[f.id])
      .map((f) => buildRow(f, state))
      .filter((r) => r.filled);

    const subgroups: ReportSubgroup[] = [];
    for (const sg of m.subgroups ?? []) {
      if (state.naSubgroups?.[sg.id]) continue;
      const visible = sg.fields.filter((f) => shouldShowField(f, state.values));
      const rows = visible
        .filter((f) => !state.nonApplicable?.[f.id])
        .map((f) => buildRow(f, state))
        .filter((r) => r.filled);
      const prog = subgroupProgress(sg, state);
      const sgStatus = computeSubgroupStatus(sg, state);
      // Subgrupos sem nenhum campo preenchido e sem observação são omitidos
      if (rows.length === 0 && !state.subgroupNotes?.[sg.id]) continue;
      subgroups.push({
        id: sg.id,
        title: sg.title,
        description: sg.description,
        status: statusLabelOf(sgStatus),
        filled: prog.filled,
        total: prog.total,
        rows,
        note: state.subgroupNotes?.[sg.id],
      });
    }

    const pend = (survey.pendencias ?? []).filter((p) => p.module === m.id || p.module === m.title);
    const atts = state.attachments ?? [];
    for (const a of atts) {
      if (a.type?.startsWith("image/")) { photos++; photoList.push({ moduleId: m.id, moduleTitle: m.title, att: a }); }
      else if (a.type?.startsWith("audio/")) { audios++; audioList.push({ moduleId: m.id, moduleTitle: m.title, att: a }); }
      else { docs++; docList.push({ moduleId: m.id, moduleTitle: m.title, att: a }); }
    }

    if (state.notes) observations.push({ moduleId: m.id, moduleTitle: m.title, text: state.notes, scope: "Módulo" });
    if (state.subgroupNotes) {
      for (const [sgId, n] of Object.entries(state.subgroupNotes)) {
        if (!n) continue;
        const sg = m.subgroups?.find((x) => x.id === sgId);
        observations.push({ moduleId: m.id, moduleTitle: m.title, text: n, scope: `Subgrupo: ${sg?.title ?? sgId}` });
      }
    }

    // Módulos sem nada relevante (sem campos preenchidos, anexos, notas ou pendências) são omitidos
    const hasContent =
      topRows.length > 0 ||
      subgroups.length > 0 ||
      atts.length > 0 ||
      !!state.notes ||
      pend.length > 0;
    if (!hasContent) continue;

    moduleReports.push({
      id: m.id,
      title: m.title,
      description: m.description,
      status: statusLabelOf(summary.status),
      filled: summary.filled,
      total: summary.total,
      paragraph: moduleParagraph(m, state, summary.filled, summary.total),
      topRows,
      subgroups,
      pendencias: pend,
      attachments: atts,
      notes: state.notes,
      fieldNotes: state.fieldNotes,
    });
  }

  const closed = !!survey.closedAt;
  const openPendencias = (survey.pendencias ?? []).filter((p) => p.status !== "concluido").length;

  // Resumo executivo
  const partsExec: string[] = [];
  partsExec.push(
    `O presente levantamento foi realizado para o cliente ${client?.name ?? "não identificado"}, no escopo de ${typeLabel.toLowerCase()}${purposeLabels.length ? `, com finalidade vinculada a ${purposeLabels.join(", ")}` : ""}.`,
  );
  partsExec.push(
    `A visita teve como objetivo registrar informações cadastrais, operacionais, ambientais e documentais do empreendimento, organizadas em ${moduleReports.length} módulo(s) habilitado(s) no formulário.`,
  );
  partsExec.push(
    `Até o momento foram preenchidos ${filledFields} de ${totalFields} campos, com ${photos} foto(s), ${docs} documento(s) e ${audios} áudio(s) anexados, e ${openPendencias} pendência(s) em aberto.`,
  );

  const purposeSection = purposeLabels.length
    ? `Este levantamento foi classificado para as finalidades ${purposeLabels.join(", ")}. As informações coletadas podem subsidiar diretamente as entregas técnicas associadas a cada uma dessas finalidades.`
    : `Nenhuma finalidade técnica foi associada a este levantamento. Recomenda-se classificar a finalidade antes do encerramento.`;

  // Seção do cliente
  let clientSection: SurveyReport["clientSection"] | undefined;
  if (client) {
    const rows: ReportRow[] = [
      ["Nome / Razão social", client.name],
      ["Tipo de pessoa", client.personType ?? ""],
      ["CNPJ/CPF", client.cnpjCpf ?? ""],
      ["Endereço", [client.address, client.bairro, client.cidade, client.uf].filter(Boolean).join(", ")],
      ["Contato", client.contact ?? ""],
      ["Telefone", client.phone ?? ""],
      ["E-mail", client.email ?? ""],
      ["Representante legal", client.repNome ?? ""],
    ].map(([label, value]) => ({
      fieldId: `client.${label}`, label: String(label), value: String(value ?? ""), filled: !!value,
    })).filter((r) => r.filled);
    clientSection = {
      paragraph: `O cliente ${client.name} é o responsável contratual pelo levantamento. Os dados cadastrais a seguir foram utilizados como referência para vincular as informações coletadas.`,
      rows,
    };
  }

  // Visita
  const ident = (survey.modules?.identificacao?.values ?? {}) as any;
  const visitRows: ReportRow[] = [
    ["Data da visita", fmtDate(ident.data_visita ?? survey.date)],
    ["Horário de chegada", ident.hora_chegada ?? ""],
    ["Objetivo", ident.objetivo ?? ""],
    ["Motivo", Array.isArray(ident.motivo) ? ident.motivo.join(", ") : (ident.motivo ?? "")],
    ["Responsável técnico", survey.responsavel ?? ""],
    ["Realizado por", survey.realizadoPor ?? ""],
    ["Status", closed ? `Encerrado em ${fmtDateTime(survey.closedAt)}` : "Em andamento"],
  ].map(([label, value]) => ({
    fieldId: `visit.${label}`, label: String(label), value: String(value ?? ""), filled: !!value,
  })).filter((r) => r.filled);
  const visitParagraph = `A visita foi ${closed ? "encerrada" : "registrada"} ${ident.data_visita || survey.date ? `em ${fmtDate(ident.data_visita ?? survey.date)}` : ""}${survey.responsavel ? `, sob responsabilidade de ${survey.responsavel}` : ""}${survey.realizadoPor ? ` e executada em campo por ${survey.realizadoPor}` : ""}.`;

  // Pendências
  const pendItems = survey.pendencias ?? [];
  const pendOpen = pendItems.filter((p) => p.status !== "concluido");
  const pendParagraph = pendItems.length === 0
    ? "Não foram identificadas pendências neste levantamento."
    : `Foram registradas ${pendItems.length} pendência(s), das quais ${pendOpen.length} permanecem em aberto. As pendências precisam de tratativa antes da consolidação final do levantamento.`;

  const closingParagraph = closed
    ? `Levantamento encerrado em ${fmtDateTime(survey.closedAt)}${survey.closedAtSaida ? `, com saída registrada às ${survey.closedAtSaida}` : ""}.${openPendencias > 0 ? ` Restam ${openPendencias} pendência(s) em aberto que devem ser tratadas em ações subsequentes.` : " Sem pendências em aberto."}`
    : `Levantamento ainda em andamento.${openPendencias > 0 ? ` Há ${openPendencias} pendência(s) em aberto a serem resolvidas antes do encerramento.` : ""}`;

  return {
    header: {
      title: survey.title,
      clientName: client?.name ?? "—",
      projectName,
      typeLabel,
      purposes: purposeLabels,
      statusLabel: closed ? "Encerrado" : "Em andamento",
      date: fmtDate(survey.date),
      closedAt: survey.closedAt ? fmtDateTime(survey.closedAt) : undefined,
      responsavel: survey.responsavel,
      realizadoPor: survey.realizadoPor,
      counters: {
        modules: moduleReports.length,
        filledFields, totalFields,
        pendencias: pendItems.length,
        photos, docs, audios,
      },
    },
    executiveSummary: partsExec.join(" "),
    purposeSection,
    clientSection,
    visitSection: { paragraph: visitParagraph, rows: visitRows },
    modules: moduleReports,
    pendencias: { paragraph: pendParagraph, items: pendItems },
    attachments: { photos: photoList, docs: docList, audios: audioList },
    observations,
    closing: { paragraph: closingParagraph, closed, closedAt: survey.closedAt, openPendencias },
  };
}
