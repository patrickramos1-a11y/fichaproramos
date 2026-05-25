import type {
  AnnualComparisonSummary,
  AnnualDataStatus,
  AnnualDocument,
  AnnualEnergyRow,
  AnnualEnvironmentalRecord,
  AnnualEnvironmentalUnit,
  AnnualLineItem,
  AnnualLineItemsSection,
  AnnualMonthKey,
  AnnualPendingItem,
  AnnualPendingStatus,
  AnnualRecordSectionKey,
  AnnualRecordStatus,
  AnnualVehicle,
  Empreendimento,
} from "./types";
import { ANNUAL_MONTH_KEYS } from "./types";

export const ANNUAL_MONTH_LABELS: Record<AnnualMonthKey, string> = {
  jan: "Jan",
  fev: "Fev",
  mar: "Mar",
  abr: "Abr",
  mai: "Mai",
  jun: "Jun",
  jul: "Jul",
  ago: "Ago",
  set: "Set",
  out: "Out",
  nov: "Nov",
  dez: "Dez",
};

export const ANNUAL_STATUS_LABELS: Record<AnnualRecordStatus, string> = {
  nao_iniciado: "Nao iniciado",
  solicitacao_enviada: "Solicitacao enviada",
  aguardando_cliente: "Aguardando cliente",
  recebido_parcialmente: "Recebido parcialmente",
  em_conferencia: "Em conferencia",
  pendente_complementacao: "Pendente de complementacao",
  consolidado: "Consolidado",
  finalizado: "Finalizado",
};

export const ANNUAL_DATA_STATUS_LABELS: Record<AnnualDataStatus, string> = {
  pendente: "Pendente",
  recebido: "Recebido",
  em_conferencia: "Em conferencia",
  validado: "Validado",
  desconsiderado: "Desconsiderado",
  substituido: "Substituido",
  nao_se_aplica: "Nao se aplica",
};

export const ANNUAL_PENDING_STATUS_LABELS: Record<AnnualPendingStatus, string> = {
  em_aberto: "Em aberto",
  solicitado_cliente: "Solicitado ao cliente",
  recebido: "Recebido",
  em_conferencia: "Em conferencia",
  resolvido: "Resolvido",
  nao_se_aplica: "Nao se aplica",
};

export const ANNUAL_SECTION_LABELS: Record<AnnualRecordSectionKey, string> = {
  identification: "Identificacao",
  units: "Unidades",
  operationalData: "Dados operacionais",
  energy: "Energia",
  rawMaterials: "Materias-primas",
  products: "Produtos",
  residues: "Residuos",
  inputs: "Insumos",
  staffAndSchedules: "Funcionarios/Horarios",
  vehicles: "Veiculos",
  waterEffluents: "Agua/Efluentes",
  analyses: "Analises",
  documents: "Documentos",
  pendingItems: "Pendencias",
  consolidation: "Consolidacao",
};

export const ANNUAL_LINE_SECTIONS = ["rawMaterials", "products", "residues", "inputs"] as const;
export type AnnualLineSectionKey = typeof ANNUAL_LINE_SECTIONS[number];

export function annualId(prefix = "annual") {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${random}`;
}

export function emptyMonthlyValues() {
  return Object.fromEntries(ANNUAL_MONTH_KEYS.map((month) => [month, null])) as Record<AnnualMonthKey, number | null>;
}

export function monthlyTotal(values?: Partial<Record<AnnualMonthKey, number | null>>) {
  return ANNUAL_MONTH_KEYS.reduce((sum, month) => {
    const value = values?.[month];
    return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
  }, 0);
}

export function monthlyFilledCount(values?: Partial<Record<AnnualMonthKey, number | null>>) {
  return ANNUAL_MONTH_KEYS.filter((month) => typeof values?.[month] === "number" && Number.isFinite(values?.[month] as number)).length;
}

export function createAnnualUnitsFromEmpreendimentos(empreendimentos: Empreendimento[]): AnnualEnvironmentalUnit[] {
  return empreendimentos.map((entry) => ({
    id: annualId("unit"),
    name: entry.name,
    empreendimentoId: entry.id,
    cidade: entry.cidade,
    uf: entry.uf,
    notes: entry.atividade,
    active: true,
  }));
}

export function normalizeAnnualEnvironmentalRecord(record: Partial<AnnualEnvironmentalRecord> & { id: string; clientId: string; yearBase: number }): AnnualEnvironmentalRecord {
  const now = new Date().toISOString();
  return {
    id: record.id,
    clientId: record.clientId,
    yearBase: Number(record.yearBase),
    previousRecordId: record.previousRecordId,
    status: record.status ?? "nao_iniciado",
    units: Array.isArray(record.units) ? record.units : [],
    identification: record.identification ?? {},
    operationalData: { periods: Array.isArray(record.operationalData?.periods) ? record.operationalData!.periods : [] },
    energy: { rows: Array.isArray(record.energy?.rows) ? record.energy!.rows : [] },
    rawMaterials: { items: Array.isArray(record.rawMaterials?.items) ? record.rawMaterials!.items : [] },
    products: { items: Array.isArray(record.products?.items) ? record.products!.items : [] },
    residues: { items: Array.isArray(record.residues?.items) ? record.residues!.items : [] },
    inputs: { items: Array.isArray(record.inputs?.items) ? record.inputs!.items : [] },
    staffAndSchedules: { periods: Array.isArray(record.staffAndSchedules?.periods) ? record.staffAndSchedules!.periods : [] },
    vehicles: { items: Array.isArray(record.vehicles?.items) ? record.vehicles!.items : [] },
    waterEffluents: {
      entries: Array.isArray(record.waterEffluents?.entries) ? record.waterEffluents!.entries : [],
      applicable: record.waterEffluents?.applicable,
    },
    analyses: { items: Array.isArray(record.analyses?.items) ? record.analyses!.items : [] },
    documents: Array.isArray(record.documents) ? record.documents : [],
    pendingItems: Array.isArray(record.pendingItems) ? record.pendingItems : [],
    consolidation: record.consolidation ?? {},
    createdAt: record.createdAt ?? now,
    updatedAt: record.updatedAt ?? record.createdAt ?? now,
  };
}

export function createEmptyAnnualEnvironmentalRecord(args: {
  clientId: string;
  yearBase: number;
  units?: AnnualEnvironmentalUnit[];
  previousRecordId?: string;
}): AnnualEnvironmentalRecord {
  const now = new Date().toISOString();
  return normalizeAnnualEnvironmentalRecord({
    id: annualId("aer"),
    clientId: args.clientId,
    yearBase: args.yearBase,
    previousRecordId: args.previousRecordId,
    status: "nao_iniciado",
    units: args.units ?? [],
    identification: {
      periodStart: `${args.yearBase}-01-01`,
      periodEnd: `${args.yearBase}-12-31`,
    },
    createdAt: now,
    updatedAt: now,
  });
}

function inheritLineItems(section: AnnualLineItemsSection | undefined, originRecordId: string): AnnualLineItemsSection {
  return {
    items: (section?.items ?? [])
      .filter((item) => item.validationState !== "removido")
      .map((item) => ({
        ...item,
        id: annualId("item"),
        monthly: emptyMonthlyValues(),
        documentIds: {},
        annualTotal: null,
        status: "pendente",
        validationState: "pendente_confirmacao",
        originRecordId,
        observation: item.observation ? `Referencia do ano anterior: ${item.observation}` : "",
      })),
  };
}

export function createAnnualRecordFromPrevious(previous: AnnualEnvironmentalRecord, yearBase: number): AnnualEnvironmentalRecord {
  const base = createEmptyAnnualEnvironmentalRecord({
    clientId: previous.clientId,
    yearBase,
    previousRecordId: previous.id,
    units: previous.units.map((unit) => ({ ...unit, id: annualId("unit"), active: unit.active ?? true })),
  });

  return normalizeAnnualEnvironmentalRecord({
    ...base,
    status: "nao_iniciado",
    identification: {
      ...base.identification,
      responsibleInternal: previous.identification.responsibleInternal,
      responsibleClient: previous.identification.responsibleClient,
      observations: "Criado com base no ano-base anterior. Confirmar itens herdados antes de consolidar.",
    },
    operationalData: {
      periods: previous.operationalData.periods.map((period) => ({
        ...period,
        id: annualId("op"),
        status: "pendente",
        observation: "Herdado do ano anterior; confirmar se manteve.",
      })),
    },
    energy: {
      rows: previous.units.map((unit) => ({
        id: annualId("energy"),
        unitId: unit.id,
        monthly: emptyMonthlyValues(),
        documentIds: {},
        status: "pendente",
      })),
    },
    rawMaterials: inheritLineItems(previous.rawMaterials, previous.id),
    products: inheritLineItems(previous.products, previous.id),
    residues: inheritLineItems(previous.residues, previous.id),
    inputs: inheritLineItems(previous.inputs, previous.id),
    staffAndSchedules: {
      periods: previous.staffAndSchedules.periods.map((period) => ({
        ...period,
        id: annualId("staff"),
        status: "pendente",
        observation: "Herdado do ano anterior; confirmar se manteve.",
      })),
    },
    vehicles: {
      items: previous.vehicles.items.map((vehicle) => ({
        ...vehicle,
        id: annualId("vehicle"),
        status: "pendente",
        validationState: "pendente_confirmacao",
        observation: vehicle.observation ? `Referencia do ano anterior: ${vehicle.observation}` : "",
      })),
    },
    waterEffluents: {
      applicable: previous.waterEffluents.applicable,
      entries: previous.waterEffluents.entries.map((entry) => ({
        ...entry,
        id: annualId("water"),
        waterConsumption: null,
        effluentVolume: null,
        linkedAnalysisIds: [],
        status: "pendente",
        observation: "Herdado do ano anterior; atualizar volumes/documentos.",
      })),
    },
    analyses: {
      items: previous.analyses.items.map((analysis) => ({
        ...analysis,
        id: annualId("analysis"),
        date: "",
        documentId: undefined,
        status: "pendente",
        validationState: "pendente_confirmacao",
        observation: "Analise recorrente herdada; confirmar se ha novo laudo.",
      })),
    },
    pendingItems: [
      {
        id: annualId("pending"),
        description: "Confirmar itens herdados do ano-base anterior.",
        status: "em_aberto",
        section: "consolidation",
        createdAt: new Date().toISOString(),
      },
    ],
  });
}

export function lineItemTotal(item: AnnualLineItem) {
  if (typeof item.annualTotal === "number" && Number.isFinite(item.annualTotal)) return item.annualTotal;
  return monthlyTotal(item.monthly);
}

function sectionHasLineData(section: AnnualLineItemsSection) {
  return section.items.some((item) => item.status === "validado" || item.status === "recebido" || monthlyFilledCount(item.monthly) > 0);
}

export function countAnnualOpenPending(record: AnnualEnvironmentalRecord) {
  return record.pendingItems.filter((item) => item.status !== "resolvido" && item.status !== "nao_se_aplica").length;
}

export function countAnnualValidDocuments(record: AnnualEnvironmentalRecord) {
  return record.documents.filter((doc) => doc.status !== "desconsiderado" && doc.status !== "substituido").length;
}

export function calculateAnnualProgress(record: AnnualEnvironmentalRecord) {
  const checks = [
    !!record.yearBase,
    record.units.length > 0,
    record.operationalData.periods.length > 0,
    record.energy.rows.some((row) => monthlyFilledCount(row.monthly) > 0),
    sectionHasLineData(record.rawMaterials),
    sectionHasLineData(record.products),
    sectionHasLineData(record.residues),
    sectionHasLineData(record.inputs),
    record.staffAndSchedules.periods.length > 0,
    record.vehicles.items.length > 0,
    record.waterEffluents.applicable === false || record.waterEffluents.entries.length > 0,
    record.analyses.items.length > 0 || record.analyses.items.every((item) => item.status === "nao_se_aplica"),
    record.documents.length > 0,
    countAnnualOpenPending(record) === 0 && record.pendingItems.length > 0,
    !!record.consolidation.technicalSummary,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function lineSectionTotal(section: AnnualLineItemsSection) {
  return section.items
    .filter((item) => item.status !== "desconsiderado" && item.validationState !== "removido")
    .reduce((sum, item) => sum + lineItemTotal(item), 0);
}

function energyTotal(record: AnnualEnvironmentalRecord) {
  return record.energy.rows.reduce((sum, row) => sum + monthlyTotal(row.monthly), 0);
}

function compare(label: string, current?: number | null, previous?: number | null): AnnualComparisonSummary {
  if (!current && !previous) return { label, currentTotal: current ?? null, previousTotal: previous ?? null, variationPercent: null, status: "pendente" };
  if (current && !previous) return { label, currentTotal: current, previousTotal: previous ?? null, variationPercent: null, status: "novo" };
  if (!current && previous) return { label, currentTotal: current ?? null, previousTotal: previous, variationPercent: null, status: "removido" };
  const variationPercent = previous ? (((current ?? 0) - previous) / previous) * 100 : null;
  const status = Math.abs(variationPercent ?? 0) < 0.01 ? "manteve" : (variationPercent ?? 0) > 0 ? "aumentou" : "diminuiu";
  return { label, currentTotal: current ?? null, previousTotal: previous ?? null, variationPercent, status };
}

export function buildAnnualComparison(current: AnnualEnvironmentalRecord, previous?: AnnualEnvironmentalRecord): AnnualComparisonSummary[] {
  return [
    compare("Energia (kWh)", energyTotal(current), previous ? energyTotal(previous) : null),
    compare("Materias-primas", lineSectionTotal(current.rawMaterials), previous ? lineSectionTotal(previous.rawMaterials) : null),
    compare("Produtos", lineSectionTotal(current.products), previous ? lineSectionTotal(previous.products) : null),
    compare("Residuos", lineSectionTotal(current.residues), previous ? lineSectionTotal(previous.residues) : null),
    compare("Insumos", lineSectionTotal(current.inputs), previous ? lineSectionTotal(previous.inputs) : null),
  ];
}

export function buildAnnualClientRequestText(record: AnnualEnvironmentalRecord, previous?: AnnualEnvironmentalRecord, clientName = "cliente") {
  const openPending = record.pendingItems.filter((item) => item.status !== "resolvido" && item.status !== "nao_se_aplica");
  const inheritedItems = [
    ...record.rawMaterials.items,
    ...record.products.items,
    ...record.residues.items,
    ...record.inputs.items,
    ...record.vehicles.items.map((vehicle: AnnualVehicle) => ({ name: vehicle.model || vehicle.plate || "Veiculo" })),
  ].filter((item) => "validationState" in item && (item as any).validationState === "pendente_confirmacao");

  const intro = previous
    ? `Estamos atualizando os dados ambientais de ${clientName} referentes ao ano-base ${record.yearBase}. Com base nas informacoes cadastradas em ${previous.yearBase}, solicitamos confirmar o que permaneceu igual, indicar alteracoes e enviar os dados mensais/documentos do novo periodo.`
    : `Estamos organizando os dados ambientais de ${clientName} referentes ao ano-base ${record.yearBase}. Solicitamos o envio das informacoes mensais e documentos de suporte para consolidacao de RAPP/RIAA e demais relatorios ambientais.`;

  const lines = [
    intro,
    "",
    "Dados solicitados:",
    "- consumo mensal de energia eletrica em kWh;",
    "- materias-primas, produtos, residuos e insumos com quantidades mensais;",
    "- certificados, MTR/CDF, planilhas, faturas e documentos de suporte;",
    "- funcionarios, horarios de funcionamento e veiculos atualizados;",
    "- analises ambientais aplicaveis e observacoes complementares.",
  ];

  if (inheritedItems.length) {
    lines.push("", "Itens herdados para confirmacao:");
    inheritedItems.slice(0, 30).forEach((item: any) => lines.push(`- ${item.name || item.model || item.plate || "Item"}`));
  }

  if (openPending.length) {
    lines.push("", "Pendencias especificas:");
    openPending.forEach((item) => lines.push(`- ${item.description}`));
  }

  lines.push("", "Por favor, informar tambem se algum dado deve ser desconsiderado, substituido ou se nao se aplica ao periodo.");
  return lines.join("\n");
}

export function buildAnnualAISummary(record: AnnualEnvironmentalRecord, clientName = "Cliente") {
  const section = (items: AnnualLineItem[]) =>
    items.map((item) => ({
      nome: item.name,
      unidade: item.unit,
      unidade_cliente: item.unitId,
      total_anual: lineItemTotal(item),
      status: item.status,
      validacao: item.validationState,
      observacao: item.observation,
    }));

  return JSON.stringify(
    {
      cliente: clientName,
      ano_base: record.yearBase,
      status: record.status,
      preenchimento_percentual: calculateAnnualProgress(record),
      unidades: record.units,
      dados_operacionais: record.operationalData,
      energia: {
        total_kwh: energyTotal(record),
        linhas: record.energy.rows,
      },
      materias_primas: section(record.rawMaterials.items),
      produtos: section(record.products.items),
      residuos: section(record.residues.items),
      insumos: section(record.inputs.items),
      funcionarios_horarios: record.staffAndSchedules,
      veiculos: record.vehicles,
      agua_efluentes: record.waterEffluents,
      analises: record.analyses,
      documentos: record.documents.map((doc: AnnualDocument) => ({
        nome: doc.name,
        tipo: doc.type,
        secao: doc.section,
        status: doc.status,
        observacao: doc.observation,
      })),
      pendencias: record.pendingItems.map((item: AnnualPendingItem) => ({
        descricao: item.description,
        secao: item.section,
        responsavel: item.responsible,
        prazo: item.dueDate,
        status: item.status,
        observacao: item.observation,
      })),
      consolidacao: record.consolidation,
    },
    null,
    2,
  );
}

export function formatAnnualNumber(value?: number | null, fractionDigits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: fractionDigits }).format(value);
}
