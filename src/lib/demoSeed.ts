/**
 * Carga de dados fictícios coerentes para demonstração.
 * Cria 6 clientes, 1 projeto/cada e 1 levantamento totalmente preenchido por tipo
 * (5 builtins + 1 personalizado "Auditoria Ambiental Operacional").
 *
 * Usa as APIs existentes do store (passam por Supabase + RLS do usuário logado).
 */
import {
  addClient, addProject, addSurveyExt, updateSurvey, setSurveyPurposes,
  addPendencia, closeSurvey, createSurveyTypeFromBase, useDB,
} from "./store";
import {
  getEffectiveModulesForType, getEffectiveModulesForCustomType, MODULE_PRESETS,
} from "./modules";
import type {
  Survey, ModuleState, FieldDef, ModuleDef, Attachment,
  SurveyPurpose, SurveyType, Person, HoursValue, FieldStatus,
  CustomSurveyType, PhotoChecklistAnswer,
} from "./types";
import { PHOTO_CHECKLISTS } from "./photoChecklists";
import { supabase } from "@/integrations/supabase/client";

/* ---------------- Placeholder data URL (1x1 PNG transparente) ---------------- */
const PLACEHOLDER_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PLACEHOLDER_PDF = "data:application/pdf;base64,JVBERi0xLjQKJSDigKIK"; // header só
const PLACEHOLDER_AUDIO = "data:audio/mpeg;base64,SUQzAwAAAAAAAA==";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function attachment(name: string, kind: "photo" | "doc" | "audio", moduleTag?: string): Attachment {
  const isPhoto = kind === "photo";
  const isAudio = kind === "audio";
  return {
    id: uid("att"),
    name,
    type: isPhoto ? "image/png" : isAudio ? "audio/mpeg" : "application/pdf",
    dataUrl: isPhoto ? PLACEHOLDER_PNG : isAudio ? PLACEHOLDER_AUDIO : PLACEHOLDER_PDF,
    createdAt: new Date().toISOString(),
    category: isPhoto ? "Fotos" : isAudio ? "Áudios" : "Documentos",
    moduleTag,
    origin: isPhoto ? "camera" : "upload",
  };
}

/* ---------------- Cenários ---------------- */

interface Scenario {
  type: SurveyType;
  customTypeId?: string;
  cliente: {
    name: string; cnpjCpf: string; atividade?: string;
    address: string; bairro: string; cidade: string; uf: string; cep: string;
    contact: string; phone: string; email: string;
    repNome: string; repCpf: string; repCargo: string;
  };
  empreendimento: { nome: string; atividade: string; cnae?: string };
  surveyTitle: string;
  purposes: SurveyPurpose[];
  responsavel: string;
  realizadoPor: string;
  acompanhante: string;
  data: string;       // YYYY-MM-DD
  horaChegada: string;
  horaSaida: string;
  coords: { lat: number; lng: number };
  endereco: string; bairro: string; cidade: string; uf: string; cep: string;
  resumoTecnico: string;
  observacoes: string;
  pendencias: { module: string; description: string; responsible: string; status: FieldStatus }[];
  photoChecklistKey?: string;
  encerrar?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    type: "geral",
    cliente: {
      name: "AgroRação Norte Ltda.",
      cnpjCpf: "12.345.678/0001-90",
      atividade: "Fabricação de alimentos para animais",
      address: "Rod. BR-316, km 12, s/n",
      bairro: "Distrito Industrial", cidade: "Marituba", uf: "PA", cep: "67200-000",
      contact: "Carlos Henrique Souza", phone: "(91) 99812-4477", email: "contato@agroracaonorte.com.br",
      repNome: "Maria Lúcia Almeida", repCpf: "456.789.123-00", repCargo: "Sócia administradora",
    },
    empreendimento: { nome: "Unidade Industrial Marituba", atividade: "Fabricação de ração balanceada para aves e suínos", cnae: "1066-0/00" },
    surveyTitle: "Levantamento Geral — Unidade Marituba",
    purposes: ["pca", "pgrs", "consultoria"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Téc. Bruno Rocha",
    acompanhante: "Carlos Henrique Souza (Gerente operacional)",
    data: "2026-04-08", horaChegada: "08:15", horaSaida: "12:40",
    coords: { lat: -1.36015, lng: -48.34210 },
    endereco: "Rod. BR-316, km 12", bairro: "Distrito Industrial", cidade: "Marituba", uf: "PA", cep: "67200-000",
    resumoTecnico:
      "Unidade fabril com 38 colaboradores, opera em 2 turnos. Captação por poço tubular profundo, reservatório de 30 m³. Geração de resíduos de embalagens plásticas, papel kraft e farelo. Possui ETE compacta para tratamento de efluentes sanitários.",
    observacoes:
      "Empresa com boa organização documental. Necessário formalizar o PGRS atualizado e regularizar outorga do poço. Lixeiras seletivas presentes, mas sem identificação adequada em alguns pontos.",
    pendencias: [
      { module: "documentos", description: "Solicitar cópia atualizada da licença ambiental de operação.", responsible: "Cliente — Maria Lúcia", status: "aguardando_documento" },
      { module: "agua", description: "Apresentar laudo de potabilidade da água do poço dos últimos 6 meses.", responsible: "Cliente — Carlos H.", status: "aguardando_documento" },
      { module: "residuos", description: "Identificar lixeiras seletivas com etiquetas padrão.", responsible: "Cliente — Setor SST", status: "pendente" },
    ],
    photoChecklistKey: "projeto",
    encerrar: true,
  },
  {
    type: "ambiental",
    cliente: {
      name: "Açaí Vale Verde Indústria e Comércio Ltda.",
      cnpjCpf: "23.456.789/0001-10",
      atividade: "Beneficiamento e polpa de açaí",
      address: "Av. Mário Covas, 2540", bairro: "Coqueiro", cidade: "Ananindeua", uf: "PA", cep: "67113-330",
      contact: "Patrícia Mendes", phone: "(91) 98221-7733", email: "ambiental@valeverdeacai.com.br",
      repNome: "José Antônio Vale", repCpf: "321.654.987-22", repCargo: "Diretor industrial",
    },
    empreendimento: { nome: "Fábrica Coqueiro", atividade: "Beneficiamento de polpa de açaí congelada", cnae: "1031-7/00" },
    surveyTitle: "Acompanhamento Ambiental — Abril/2026",
    purposes: ["acompanhamento", "monitoramento", "pgrs"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Téc. Larissa Cordeiro",
    acompanhante: "Patrícia Mendes (Analista ambiental interna)",
    data: "2026-04-22", horaChegada: "09:00", horaSaida: "11:15",
    coords: { lat: -1.34890, lng: -48.39115 },
    endereco: "Av. Mário Covas, 2540", bairro: "Coqueiro", cidade: "Ananindeua", uf: "PA", cep: "67113-330",
    resumoTecnico:
      "Visita mensal de acompanhamento. ETE em operação parcial — leitura turva no decantador. Coleta de resíduos orgânicos sendo realizada por terceiro homologado. Treinamento de educação ambiental aplicado a 14 colaboradores em março/2026.",
    observacoes:
      "Recomendado novo dosagem de cloreto férrico. Caroços de açaí estocados ao tempo aguardando coleta — orientar cobertura. Resíduos não-recicláveis misturados com orgânicos em uma das lixeiras.",
    pendencias: [
      { module: "ete", description: "Realizar limpeza do decantador da ETE e ajustar dosagem de coagulante.", responsible: "Equipe de manutenção", status: "pendente" },
      { module: "residuos", description: "Cobrir baia de armazenamento de caroços de açaí.", responsible: "Setor de logística", status: "pendente" },
      { module: "rotinas", description: "Atualizar planilha mensal de geração de resíduos orgânicos.", responsible: "Patrícia Mendes", status: "requer_retorno" },
    ],
    photoChecklistKey: "acompanhamento",
    encerrar: true,
  },
  {
    type: "vazao",
    cliente: {
      name: "Fazenda Boa Esperança",
      cnpjCpf: "34.567.890/0001-55",
      atividade: "Atividade agropecuária",
      address: "Estrada Vicinal Boa Esperança, km 7", bairro: "Zona Rural", cidade: "Castanhal", uf: "PA", cep: "68740-000",
      contact: "Antônio Lima", phone: "(91) 99115-2244", email: "fazendaboaesperanca@gmail.com",
      repNome: "Antônio Lima Sobrinho", repCpf: "789.123.456-11", repCargo: "Proprietário",
    },
    empreendimento: { nome: "Sede Fazenda Boa Esperança", atividade: "Pecuária e cultivo de milho", cnae: "0151-2/01" },
    surveyTitle: "Medição de Vazão — Igarapé do Cipó",
    purposes: ["outorga", "monitoramento", "acompanhamento_processo"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Téc. Bruno Rocha",
    acompanhante: "Antônio Lima (Proprietário)",
    data: "2026-04-14", horaChegada: "07:40", horaSaida: "10:20",
    coords: { lat: -1.30122, lng: -47.92355 },
    endereco: "Estrada Vicinal Boa Esperança, km 7", bairro: "Zona Rural", cidade: "Castanhal", uf: "PA", cep: "68740-000",
    resumoTecnico:
      "Medição realizada em seção retilínea do igarapé do Cipó. Largura média 1,85 m, profundidade média 0,42 m. Velocidade superficial estimada por método do flutuador em 0,38 m/s. Vazão estimada ≈ 0,29 m³/s.",
    observacoes:
      "Curso d'água com leito arenoso e baixa turbidez. Margens com vegetação ciliar preservada em ~70%. Trecho selecionado distante 25 m de pequena queda natural.",
    pendencias: [
      { module: "documentos", description: "Anexar certidão de domínio da área para complementar processo de outorga.", responsible: "Cliente", status: "aguardando_documento" },
    ],
    photoChecklistKey: "vazao",
    encerrar: true,
  },
  {
    type: "outorga",
    cliente: {
      name: "Tintas Amazônia Ltda.",
      cnpjCpf: "45.678.901/0001-22",
      atividade: "Fabricação de tintas e vernizes",
      address: "Av. Independência, 4180", bairro: "Águas Lindas", cidade: "Ananindeua", uf: "PA", cep: "67030-000",
      contact: "Felipe Tavares", phone: "(91) 98777-6611", email: "engenharia@tintasamazonia.com.br",
      repNome: "Roberta Tavares Mendonça", repCpf: "654.321.987-44", repCargo: "Diretora técnica",
    },
    empreendimento: { nome: "Planta Industrial Águas Lindas", atividade: "Fabricação de tintas imobiliárias e industriais", cnae: "2071-1/00" },
    surveyTitle: "Outorga de Captação — Poço PT-01",
    purposes: ["outorga", "acompanhamento_processo"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Téc. Bruno Rocha",
    acompanhante: "Felipe Tavares (Engenheiro de produção)",
    data: "2026-04-29", horaChegada: "08:30", horaSaida: "11:50",
    coords: { lat: -1.36740, lng: -48.41512 },
    endereco: "Av. Independência, 4180", bairro: "Águas Lindas", cidade: "Ananindeua", uf: "PA", cep: "67030-000",
    resumoTecnico:
      "Poço tubular PT-01 com 96 m de profundidade, diâmetro de 6\". Bomba submersa Schneider 5 CV. Nível estático 14,2 m, nível dinâmico 28,7 m. Vazão requerida: 6,5 m³/h. Tempo de captação: 8 h/dia. Reservatório elevado de 20 m³.",
    observacoes:
      "Empresa apresenta histórico de uso e estrutura adequada para regularização. Faltam apenas documentos cartoriais. Hidrômetro instalado e calibrado em jan/2026.",
    pendencias: [
      { module: "documentos", description: "Fornecer matrícula atualizada do imóvel (até 30 dias).", responsible: "Cliente — Roberta T.", status: "aguardando_documento" },
      { module: "outorga", description: "Atualizar análise físico-química da água do poço PT-01.", responsible: "Laboratório credenciado", status: "aguardando_empresa" },
    ],
    photoChecklistKey: "outorga",
    encerrar: false,
  },
  {
    type: "terreno",
    cliente: {
      name: "Sítio Santa Clara",
      cnpjCpf: "111.222.333-44",
      atividade: "Imóvel rural — avaliação para implantação",
      address: "Ramal Santa Clara, km 3", bairro: "Zona Rural", cidade: "Benevides", uf: "PA", cep: "68795-000",
      contact: "Marcos Vinícius Andrade", phone: "(91) 99011-3322", email: "marcos.andrade@email.com",
      repNome: "Marcos Vinícius Andrade", repCpf: "111.222.333-44", repCargo: "Proprietário",
    },
    empreendimento: { nome: "Sítio Santa Clara — Lote 14", atividade: "Área para implantação de pequena indústria de polpa", cnae: "" },
    surveyTitle: "Visita Técnica — Sítio Santa Clara",
    purposes: ["consultoria", "pca", "auditoria"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Eng. Renata Pacheco",
    acompanhante: "Marcos Vinícius Andrade (Proprietário)",
    data: "2026-05-02", horaChegada: "08:00", horaSaida: "12:00",
    coords: { lat: -1.36190, lng: -48.24008 },
    endereco: "Ramal Santa Clara, km 3", bairro: "Zona Rural", cidade: "Benevides", uf: "PA", cep: "68795-000",
    resumoTecnico:
      "Terreno de 18.500 m², formato retangular (~125 m × 148 m), topografia levemente ondulada com declividade média de 3%. Solo arenoso-argiloso, vegetação secundária em 40% da área. Acesso por estrada não-pavimentada, energia trifásica disponível a 180 m da divisa.",
    observacoes:
      "Vizinhança composta por chácaras e pequenos sítios. Ausência de corpo hídrico no interior. Necessário avaliar APP de nascente identificada a 60 m do limite norte.",
    pendencias: [
      { module: "documentos", description: "Obter matrícula atualizada e ART do levantamento topográfico.", responsible: "Cliente", status: "aguardando_documento" },
      { module: "areas", description: "Confirmar limites com a propriedade vizinha (Sr. Joaquim).", responsible: "Equipe técnica", status: "requer_retorno" },
    ],
    photoChecklistKey: "visita_terreno",
    encerrar: true,
  },
  {
    type: "ambiental", // base
    customTypeId: "__PLACEHOLDER__", // preenchido em runtime
    cliente: {
      name: "Indústria Bela Cor Ltda.",
      cnpjCpf: "56.789.012/0001-77",
      atividade: "Fabricação de produtos químicos diversos",
      address: "Tv. WE-19, 88 — Cidade Nova", bairro: "Cidade Nova", cidade: "Ananindeua", uf: "PA", cep: "67133-180",
      contact: "Aline Castro", phone: "(91) 98655-4422", email: "qualidade@belacor.com.br",
      repNome: "Eduardo Bela Cor", repCpf: "987.654.321-99", repCargo: "Diretor presidente",
    },
    empreendimento: { nome: "Planta Cidade Nova", atividade: "Fabricação de tintas e produtos químicos para construção", cnae: "2071-1/00" },
    surveyTitle: "Auditoria Ambiental Operacional — Maio/2026",
    purposes: ["auditoria", "consultoria", "acompanhamento"],
    responsavel: "Eng. Renata Pacheco — CREA-PA 178540",
    realizadoPor: "Téc. Larissa Cordeiro",
    acompanhante: "Aline Castro (Coordenadora de qualidade)",
    data: "2026-05-06", horaChegada: "08:45", horaSaida: "13:10",
    coords: { lat: -1.35712, lng: -48.40220 },
    endereco: "Tv. WE-19, 88", bairro: "Cidade Nova", cidade: "Ananindeua", uf: "PA", cep: "67133-180",
    resumoTecnico:
      "Auditoria operacional cobrindo 7 áreas críticas: armazenamento de produtos químicos, gestão de resíduos perigosos, ETE industrial, sinalização de emergência, EPIs, rotulagem de tambores e plano de atendimento a emergências.",
    observacoes:
      "12 não-conformidades identificadas, sendo 3 de prioridade alta. Empresa apresenta SGI implantado parcialmente. Reforço em treinamento NR-20 recomendado.",
    pendencias: [
      { module: "residuos", description: "Reorganizar armazenamento temporário de resíduos perigosos com bacia de contenção.", responsible: "Equipe SESMT", status: "pendente" },
      { module: "ete", description: "Calibrar pH-metro online da ETE industrial.", responsible: "Manutenção", status: "pendente" },
      { module: "documentos", description: "Atualizar FISPQs dos solventes XK-12 e XK-18.", responsible: "Compras", status: "aguardando_documento" },
    ],
    photoChecklistKey: "acompanhamento",
    encerrar: false,
  },
];

/* ---------------- Geração heurística de valores ---------------- */

function fillField(field: FieldDef, scenario: Scenario, mod: ModuleDef, sub?: string): any {
  const id = field.id;
  const ctx = scenario;

  // Overrides por id conhecido (catálogo).
  const idMap: Record<string, any> = {
    data_visita: ctx.data,
    hora_chegada: ctx.horaChegada,
    hora_saida: ctx.horaSaida,
    objetivo: ctx.resumoTecnico,
    motivo: ["Levantamento de projetos", "Visita técnica"].slice(0, 1),
    local_nome: ctx.empreendimento.nome,
    local_endereco: ctx.endereco, local_bairro: ctx.bairro, local_cidade: ctx.cidade, local_uf: ctx.uf, local_cep: ctx.cep,
    empresa: ctx.cliente.name,
    cnpj_cpf: ctx.cliente.cnpjCpf,
    ie: "15.345.678-9", im: "987.654-3",
    atividade: ctx.empreendimento.atividade,
    cnae: ctx.empreendimento.cnae ?? "",
    endereco: ctx.endereco, bairro: ctx.bairro, cidade: ctx.cidade, uf: ctx.uf, cep: ctx.cep,
    rep_nome: ctx.cliente.repNome, rep_rg: "MG-12.345.678", rep_cpf: ctx.cliente.repCpf, rep_cargo: ctx.cliente.repCargo,
    rep_email: ctx.cliente.email, rep_telefone: ctx.cliente.phone,
    coord_emp: { lat: ctx.coords.lat, lng: ctx.coords.lng },
    coord_local: { lat: ctx.coords.lat, lng: ctx.coords.lng },
    coord_poco: { lat: ctx.coords.lat + 0.0004, lng: ctx.coords.lng - 0.0006 },
    coordenadas: { lat: ctx.coords.lat, lng: ctx.coords.lng },
  };
  if (id in idMap) return idMap[id];

  // Campos de pessoas
  if (field.type === "people") {
    const tec: Person = { id: uid("p"), nome: ctx.responsavel.split(" — ")[0], cargo: "Eng. Ambiental", registro: "CREA-PA 178540", telefone: "(91) 99800-0001", email: "renata@ramos.eng.br" };
    const colab: Person = { id: uid("p"), nome: ctx.acompanhante.split(" (")[0], cargo: ctx.acompanhante.includes("(") ? ctx.acompanhante.match(/\(([^)]+)\)/)?.[1] ?? "Representante" : "Representante", telefone: ctx.cliente.phone, email: ctx.cliente.email };
    if (id.includes("tec")) return [tec];
    if (id.includes("colab")) return [colab];
    return [tec, colab];
  }

  // Horários
  if (field.type === "hours-presets") {
    const hv: HoursValue = {
      preset: "comercial",
      dias: ["seg", "ter", "qua", "qui", "sex"],
      turnos: [{ id: "t1", inicio: "07:00", fim: "17:00", label: "Turno único" }],
      observacao: "Funcionamento administrativo segunda a sexta; produção em 2 turnos.",
    };
    return hv;
  }

  if (field.type === "coords") return { lat: ctx.coords.lat, lng: ctx.coords.lng };

  if (field.type === "boolean") return true;

  if (field.type === "date") return ctx.data;
  if (field.type === "time") return "09:30";

  if (field.type === "select") {
    if (id === "uf") return ctx.uf;
    return field.options?.[0] ?? "";
  }

  if (field.type === "multiselect" || (field.type === "button-select" && field.multi)) {
    return field.options?.slice(0, Math.min(2, field.options.length)) ?? [];
  }
  if (field.type === "button-select") return field.options?.[0] ?? "";

  if (field.type === "apply-to-sides") {
    const sides = field.sides ?? ["norte", "sul", "leste", "oeste"];
    const out: Record<string, any> = {};
    for (const s of sides) out[s] = "Confrontante particular — sem ocorrências relevantes";
    return out;
  }

  if (field.type === "repeater") {
    const item: Record<string, any> = {};
    (field.itemFields ?? []).forEach((f) => {
      item[f.id] = fillField(f, scenario, mod, sub);
    });
    item.id = uid("it");
    return [item];
  }

  if (field.type === "number" || field.type === "quantity") {
    // Heurística por palavra-chave
    const lab = (field.label || "").toLowerCase();
    if (lab.includes("profundidade") && id.startsWith("p")) return [0.32, 0.40, 0.45, 0.48, 0.50, 0.46, 0.42, 0.38, 0.34][parseInt(id.replace(/[^0-9]/g, "") || "1") - 1] ?? 0.42;
    if (lab.includes("tempo") && id.startsWith("t")) return [12.4, 12.8, 12.5, 12.6, 12.7][parseInt(id.replace(/[^0-9]/g, "") || "1") - 1] ?? 12.6;
    if (lab.includes("largura")) return 1.85;
    if (lab.includes("comprimento")) return 5.20;
    if (lab.includes("área") || lab.includes("area")) return 18500;
    if (lab.includes("vazão") || lab.includes("vazao")) return 6.5;
    if (lab.includes("profundidade")) return 96;
    if (lab.includes("diâmetro") || lab.includes("diametro")) return 6;
    if (lab.includes("nível estático") || lab.includes("nivel estatico")) return 14.2;
    if (lab.includes("nível dinâmico") || lab.includes("nivel dinamico")) return 28.7;
    if (lab.includes("cv") || lab.includes("potência")) return 5;
    if (lab.includes("reservat")) return 20;
    if (lab.includes("funcionário") || lab.includes("colaborador")) return 38;
    if (field.unitOptions) return { value: 100, unit: field.unitOptions[0] };
    return 10;
  }

  if (field.type === "textarea") {
    return ctx.observacoes;
  }

  if (field.type === "text") {
    const lab = (field.label || "").toLowerCase();
    if (lab.includes("marca")) return "Schneider";
    if (lab.includes("modelo")) return "SP-5HP";
    if (lab.includes("nome")) return ctx.cliente.repNome;
    if (lab.includes("cnpj")) return ctx.cliente.cnpjCpf;
    return "Registrado em campo";
  }

  return undefined;
}

function buildModuleState(mod: ModuleDef, scenario: Scenario): ModuleState {
  const values: Record<string, any> = {};
  const fieldStatus: Record<string, FieldStatus> = {};
  const fieldNotes: Record<string, string> = {};

  const allFields: { f: FieldDef; sub?: string }[] = [];
  (mod.fields ?? []).forEach((f) => allFields.push({ f }));
  (mod.subgroups ?? []).forEach((sg) => sg.fields.forEach((f) => allFields.push({ f, sub: sg.id })));

  for (const { f, sub } of allFields) {
    if (["photo", "document", "audio", "drawing", "signature", "status", "geometries"].includes(f.type)) continue;
    const v = fillField(f, scenario, mod, sub);
    if (v === undefined || v === null) continue;
    values[f.id] = v;
    fieldStatus[f.id] = "concluido";
  }

  // Anexos placeholder no nível do módulo.
  const attachments: Attachment[] = [
    attachment(`foto_${mod.id}_01.jpg`, "photo", mod.id),
  ];
  if (mod.id === "documentos") {
    attachments.push(attachment("contrato_social.pdf", "doc", mod.id));
    attachments.push(attachment("cartao_cnpj.pdf", "doc", mod.id));
    attachments.push(attachment("relatorio_analise_agua.pdf", "doc", mod.id));
  }
  if (mod.id === "fotos") {
    attachments.length = 0;
    for (const name of [
      "foto_entrada_empresa_01.jpg", "foto_galpao_producao_01.jpg",
      "foto_poco_01.jpg", "foto_reservatorio_01.jpg",
      "foto_ete_01.jpg", "foto_lixeiras_01.jpg",
    ]) attachments.push(attachment(name, "photo", "fotos"));
    attachments.push(attachment("audio_observacoes_gerais.mp3", "audio", "fotos"));
  }

  // Photo checklist (apenas no módulo "fotos").
  let photoChecklist: PhotoChecklistAnswer[] | undefined;
  let photoChecklistKeys: string[] | undefined;
  if (mod.id === "fotos" && scenario.photoChecklistKey) {
    const tpl = (PHOTO_CHECKLISTS as any)[scenario.photoChecklistKey];
    if (tpl) {
      photoChecklistKeys = [scenario.photoChecklistKey];
      photoChecklist = tpl.items.slice(0, Math.min(8, tpl.items.length)).map((it: any, idx: number) => ({
        itemId: `${tpl.key}.${it.id}`,
        label: it.label,
        templateKey: tpl.key,
        registrado: idx % 5 !== 4, // 4/5 marcados como Sim
        observacao: idx === 0 ? "Registrado conforme planejado." : undefined,
        updatedAt: new Date().toISOString(),
      }));
    }
  }

  return {
    status: "concluido",
    values,
    fieldStatus,
    fieldNotes,
    attachments,
    nonApplicable: {},
    moduleDone: true,
    photoChecklist,
    photoChecklistKeys,
    notes: scenario.observacoes,
  };
}

/* ---------------- Pipeline principal ---------------- */

async function ensureAuthed() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) throw new Error("Você precisa estar autenticado para gerar dados de demonstração.");
}

export async function seedDemoData(): Promise<{ created: number; surveys: string[] }> {
  await ensureAuthed();

  // 1) Tipo personalizado "Auditoria Ambiental Operacional"
  const ambientalMinimal = MODULE_PRESETS.ambiental.minimal;
  const customType: CustomSurveyType = createSurveyTypeFromBase({
    label: "Auditoria Ambiental Operacional",
    description: "Auditoria operacional de conformidade ambiental em unidades industriais.",
    sourceTypeId: "ambiental",
    color: "#15803d",
    icon: "ShieldCheck",
    moduleBindings: ambientalMinimal.map((mid, i) => ({
      moduleId: mid,
      requirement: i < 3 ? "obrigatorio" : "recomendado",
    })),
  });

  const surveyIds: string[] = [];
  for (const sc of SCENARIOS) {
    if (sc.customTypeId === "__PLACEHOLDER__") sc.customTypeId = customType.id;

    // 2) Cliente + projeto
    const client = addClient({
      name: sc.cliente.name,
      personType: sc.cliente.cnpjCpf.length > 14 ? "PJ" : "PF",
      cnpjCpf: sc.cliente.cnpjCpf,
      address: sc.cliente.address, bairro: sc.cliente.bairro, cidade: sc.cliente.cidade, uf: sc.cliente.uf, cep: sc.cliente.cep,
      contact: sc.cliente.contact, phone: sc.cliente.phone, email: sc.cliente.email,
      repNome: sc.cliente.repNome, repCpf: sc.cliente.repCpf, repCargo: sc.cliente.repCargo,
      repEmail: sc.cliente.email, repPhone: sc.cliente.phone,
      notes: `Cliente fictício de demonstração — ${sc.cliente.atividade ?? ""}`,
    });
    const project = addProject({ clientId: client.id, name: `Projeto ${sc.empreendimento.nome}`, description: sc.resumoTecnico });

    // 3) Levantamento
    const survey = addSurveyExt({
      clientId: client.id,
      projectId: project.id,
      type: sc.type,
      title: sc.surveyTitle,
      customTypeId: sc.customTypeId,
    });
    surveyIds.push(survey.id);

    // 4) Resolve módulos efetivos
    const ct = sc.customTypeId ? customType : undefined;
    const modules = ct ? getEffectiveModulesForCustomType(ct) : getEffectiveModulesForType(sc.type);

    // 5) Constrói estado de todos os módulos
    const moduleState: Record<string, ModuleState> = {};
    for (const m of modules) moduleState[m.id] = buildModuleState(m, sc);

    updateSurvey(survey.id, {
      modules: moduleState,
      enabledModules: modules.map((m) => m.id),
      date: sc.data,
      responsavel: sc.responsavel,
      realizadoPor: sc.realizadoPor,
      signatures: { client: sc.cliente.repNome, technician: sc.responsavel, date: sc.data },
    });

    // 6) Finalidades + pendências
    setSurveyPurposes(survey.id, sc.purposes);
    for (const p of sc.pendencias) addPendencia(survey.id, p);

    // 7) Encerramento
    if (sc.encerrar) closeSurvey(survey.id, sc.horaSaida);
  }

  return { created: surveyIds.length, surveys: surveyIds };
}

/** Verifica se já existe dado de seed (cliente AgroRação Norte). Útil para evitar duplicação. */
export function hasDemoData(db: ReturnType<typeof useDB>) {
  return db.clients.some((c) => c.name === "AgroRação Norte Ltda.");
}
