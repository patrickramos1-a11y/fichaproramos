/** Tipos de levantamento embutidos (de fábrica). Tipos personalizados usam ids livres `custom_*`. */
export type BuiltInSurveyType =
  | "geral"
  | "ambiental"
  | "vazao"
  | "outorga"
  | "terreno";

/** Identificador de tipo de levantamento — pode ser embutido ou um id de tipo personalizado. */
export type SurveyType = string;

export const BUILTIN_SURVEY_TYPE_IDS: BuiltInSurveyType[] = ["geral", "ambiental", "vazao", "outorga", "terreno"];

export const SURVEY_TYPES: { id: BuiltInSurveyType; label: string; description: string }[] = [
  { id: "geral", label: "Levantamento Geral de Projetos", description: "Coleta ampla de dados de empresa, atividade, água, resíduos, efluentes e processo." },
  { id: "ambiental", label: "Acompanhamento Ambiental", description: "Controle periódico de conformidade, ETE, resíduos, documentos e pendências." },
  { id: "vazao", label: "Medição de Vazão", description: "Registro técnico de seção, profundidades, tempos e desenho." },
  { id: "outorga", label: "Outorga", description: "Coleta para processo de outorga: poço, bomba, reservatório e representante legal." },
  { id: "terreno", label: "Visita ao Local / Terreno", description: "Caracterização física: limites, topografia, vegetação, solo, acesso e vizinhança." },
];

export type FieldStatus =
  | "nao_iniciado"
  | "em_andamento"
  | "concluido"
  | "pendente"
  | "nao_se_aplica"
  | "aguardando_documento"
  | "aguardando_empresa"
  | "requer_retorno";

export const STATUS_LABELS: Record<FieldStatus, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  pendente: "Pendente",
  nao_se_aplica: "Não se aplica",
  aguardando_documento: "Aguardando documento",
  aguardando_empresa: "Aguardando empresa",
  requer_retorno: "Requer retorno",
};

export const STATUS_COLOR: Record<FieldStatus, string> = {
  nao_iniciado: "var(--status-todo)",
  em_andamento: "var(--status-progress)",
  concluido: "var(--status-done)",
  pendente: "var(--status-pending)",
  nao_se_aplica: "var(--status-na)",
  aguardando_documento: "var(--status-doc)",
  aguardando_empresa: "var(--status-company)",
  requer_retorno: "var(--status-return)",
};

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "quantity"
  | "date"
  | "time"
  | "select"
  | "multiselect"
  | "boolean"
  | "coords"
  | "geometries"
  | "people"
  | "hours-presets"
  | "button-select"
  | "repeater"
  | "apply-to-sides"
  | "photo"
  | "document"
  | "audio"
  | "drawing"
  | "signature"
  | "status";

/** Pessoa em listas dinâmicas (Pessoas Envolvidas etc.). */
export interface Person {
  id: string;
  nome: string;
  cargo?: string;
  vinculo?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  registro?: string;
}

/** Configuração de funcionamento / horários com presets. */
export type HoursPreset =
  | "comercial"
  | "2turnos"
  | "3turnos"
  | "24h"
  | "outro";

export interface HoursTurno {
  id: string;
  inicio: string;
  fim: string;
  label?: string;
}

export interface HoursValue {
  preset?: HoursPreset;
  dias?: string[];
  turnos?: HoursTurno[];
  observacao?: string;
}

/** Finalidade dos módulos para classificação/filtros. */
export type ModulePurpose = "projeto" | "acompanhamento" | "monitoramento" | "outorga" | "vazao";

export const MODULE_PURPOSE_LABELS: Record<ModulePurpose, string> = {
  projeto: "Projeto",
  acompanhamento: "Acompanhamento",
  monitoramento: "Monitoramento",
  outorga: "Outorga",
  vazao: "Vazão",
};

/** Finalidade do levantamento (para que aquele levantamento serve). Seleção múltipla por levantamento. */
export type SurveyPurpose =
  | "pca"
  | "pgrs"
  | "pea"
  | "riaa"
  | "outorga"
  | "auditoria"
  | "consultoria"
  | "acompanhamento"
  | "monitoramento"
  | "acompanhamento_processo"
  | "outro";

export const SURVEY_PURPOSE_LABELS: Record<SurveyPurpose, string> = {
  pca: "PCA",
  pgrs: "PGRS",
  pea: "PEA",
  riaa: "RIAA",
  outorga: "Outorga",
  auditoria: "Auditoria",
  consultoria: "Consultoria",
  acompanhamento: "Acompanhamento",
  monitoramento: "Monitoramento",
  acompanhamento_processo: "Acomp. processo",
  outro: "Outro",
};

export const SURVEY_PURPOSE_DESCRIPTIONS: Record<SurveyPurpose, string> = {
  pca: "Plano de Controle Ambiental",
  pgrs: "Plano de Gerenciamento de Resíduos Sólidos",
  pea: "Programa de Educação Ambiental",
  riaa: "Relatório/Instrumento Ambiental relacionado",
  outorga: "Processo de outorga",
  auditoria: "Auditoria ambiental ou técnica",
  consultoria: "Consultoria técnica geral",
  acompanhamento: "Acompanhamento ambiental ou operacional",
  monitoramento: "Monitoramento periódico",
  acompanhamento_processo: "Acompanhamento de processo em andamento",
  outro: "Finalidade não listada",
};

export const ALL_SURVEY_PURPOSES: SurveyPurpose[] = [
  "pca", "pgrs", "pea", "riaa", "outorga", "auditoria", "consultoria",
  "acompanhamento", "monitoramento", "acompanhamento_processo", "outro",
];

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  /** Condicional: só exibe se a regra for satisfeita pelos valores do mesmo módulo. */
  showIf?: {
    field: string;
    equals?: unknown;
    in?: unknown[];
    truthy?: boolean;
  };
  /** button-select: permite múltipla seleção. */
  multi?: boolean;
  /** button-select / repeater: oferece opção "Outra" inline. */
  allowOther?: boolean;
  /** repeater: campos de cada item. */
  itemFields?: FieldDef[];
  /** repeater: rótulo para o botão de adicionar item. */
  addItemLabel?: string;
  /** number: lista de presets clicáveis. */
  presets?: Array<string | number>;
  /** number: opções de unidade (substitui `unit`). */
  unitOptions?: string[];
  /** number: aceita decimais (default true). */
  decimal?: boolean;
  /** apply-to-sides: rótulos dos lados. */
  sides?: string[];
  /** button-select: aprende novas opções "Outra" no localStorage por field.id. */
  learn?: boolean;
  /** repeater (labelField): salva ao apertar Enter e cria novo item já em foco. */
  enterToAdd?: boolean;
  /** repeater item: campo opcional acessível via balão "Comentar". */
  commentable?: boolean;
  /** number: sugere valor calculado a partir de outros campos do módulo. */
  suggestFrom?: { kind: "areaFromDims" | "areaFromVazao" };
  /** repeater: não memoriza presets globais (cada empresa é única). */
  noPresetMemory?: boolean;
  /** repeater (primeiro field): mapeia valor → cor (CSS) usada na borda do item. */
  colorByValue?: Record<string, string>;
  /** repeater item field: ao mudar o campo `from`, sugere valor pelo `map` se estiver vazio. */
  autoLink?: { from: string; map: Record<string, string> };
  /** repeater item field: mostra botão "aplicar a outros" para copiar este valor para os demais itens. */
  applyToOthers?: boolean;
  /** repeater (labelField): mapeia valor → emoji exibido como prefixo. */
  iconByValue?: Record<string, string>;
  /** repeater item field: esconde o seletor quando `autoLink` foi resolvido (mostra só info). */
  hideWhenAutoLinked?: boolean;
  /** repeater item field: mostra apenas o valor + editar quando preenchido. */
  collapseWhenFilled?: boolean;
  /** repeater (labelField): valores que dispensam campo de classificação (já carregam a classe no nome). */
  classOnlyValues?: string[];
}

export interface ModuleDef {
  id: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  subgroups?: SubgroupDef[];
  /** Tags de finalidade para filtros rápidos. */
  purposes?: ModulePurpose[];
}

export interface SubgroupDef {
  id: string;
  title: string;
  description?: string;
  fields: FieldDef[];
  /** Subgrupo opcional: não conta para "não iniciado" / progresso quando vazio. */
  optional?: boolean;
}

export interface Client {
  id: string;
  name: string;
  personType?: "PJ" | "PF";
  cnpjCpf?: string;
  ie?: string;
  im?: string;
  address?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  contact?: string;
  phone?: string;
  email?: string;
  // Representante legal (para o caso PJ)
  repNome?: string;
  repRg?: string;
  repCpf?: string;
  repCargo?: string;
  repEmail?: string;
  repPhone?: string;
  notes?: string;
  createdAt: string;
}

export interface Empreendimento {
  id: string;
  clientId: string;
  name: string;
  cnpjCpf?: string;
  atividade?: string;
  cnae?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  latitude?: string;
  longitude?: string;
  contatoLocal?: string;
  telefoneLocal?: string;
  notes?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  empreendimentoId?: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  createdAt: string;
  /** Categoria livre para organização central (ex.: "Licenças", "Fotos"). */
  category?: string;
  /** Módulo de origem/contexto (opcional). */
  moduleTag?: string;
  /** Vincula este anexo a um item do checklist do Relatório Fotográfico. */
  photoItemId?: string;
  /** Origem do anexo (informativo). */
  origin?: "camera" | "biblioteca" | "upload";
}

/** Resposta de um item do checklist do Relatório Fotográfico. */
export interface PhotoChecklistAnswer {
  /** Chave estável do template (ex.: "projeto.fachada_entrada"). */
  itemId: string;
  /** Rótulo legível denormalizado (preserva histórico se template mudar). */
  label: string;
  /** Chave do template a que o item pertence. */
  templateKey: string;
  /** true = Sim, false = Não. */
  registrado: boolean;
  observacao?: string;
  updatedAt: string;
}

export interface ModuleState {
  status: FieldStatus;
  values: Record<string, any>;
  fieldStatus: Record<string, FieldStatus>;
  notes?: string;
  attachments: Attachment[];
  /** Observações pontuais por campo/bloco. */
  fieldNotes?: Record<string, string>;
  /** Observações por subgrupo (uma por subgrupo). */
  subgroupNotes?: Record<string, string>;
  /** Marcações de "Não se aplica" por campo/bloco. */
  nonApplicable?: Record<string, boolean>;
  /** Marcação "Não se aplica" para o módulo inteiro. */
  naModule?: boolean;
  /** Marcações "Não se aplica" por subgrupo. */
  naSubgroups?: Record<string, boolean>;
  /** Marcação manual de módulo concluído. */
  moduleDone?: boolean;
  /** Marcação manual de conclusão por subgrupo. */
  subgroupDone?: Record<string, boolean>;
  /** Apenas no módulo "fotos": respostas do checklist de Relatório Fotográfico. */
  photoChecklist?: PhotoChecklistAnswer[];
  /** Apenas no módulo "fotos": templates ativos no levantamento. */
  photoChecklistKeys?: string[];
  /** Apenas no módulo "fotos" do tipo Post: liberação de divulgação. */
  photoLiberadoDivulgacao?: boolean;
}

export interface Pendencia {
  id: string;
  module: string;
  description: string;
  responsible?: string;
  status: FieldStatus;
  createdAt: string;
}

export interface Survey {
  id: string;
  clientId: string;
  projectId?: string;
  empreendimentoId?: string;
  type: SurveyType;
  title: string;
  date: string;
  modules: Record<string, ModuleState>;
  pendencias: Pendencia[];
  signatures: { client?: string; technician?: string; date?: string };
  createdAt: string;
  /** IDs de módulos habilitados; quando undefined, etapa de configuração é exibida. */
  enabledModules?: string[];
  /** Timestamp ISO de encerramento do levantamento (trava edições). */
  closedAt?: string;
  /** Horário de saída registrado no encerramento. */
  closedAtSaida?: string;
  /** Quando preenchido, o levantamento usa um tipo personalizado em vez do builtin. */
  customTypeId?: string;
  /** Finalidades do levantamento (PCA, PGRS, etc). */
  purposes?: SurveyPurpose[];
  /** Responsável técnico ou gestor. */
  responsavel?: string;
  /** Pessoa que realizou o levantamento em campo. */
  realizadoPor?: string;
}

/** Template de configuração de módulos (reutilizável entre levantamentos). */
export interface SurveyTemplate {
  id: string;
  name: string;
  type: SurveyType;
  moduleIds: string[];
  createdAt: string;
  /** Quando true, vira preset padrão para esse tipo no novo levantamento. */
  isDefault?: boolean;
  /** Templates de fábrica não podem ser removidos. */
  builtIn?: boolean;
  /** Subgrupos desabilitados por módulo (serão marcados como N/A ao criar levantamento). */
  subgroupOverrides?: Record<string, string[]>;
  /** Descrição livre exibida na listagem. */
  description?: string;
}

/* ============ Estrutura dos formulários (overrides) ============ */

/** Patch parcial aplicado sobre um campo de fábrica. */
export type FieldPatch = Partial<
  Pick<
    FieldDef,
    | "label"
    | "type"
    | "options"
    | "unit"
    | "placeholder"
    | "multi"
    | "allowOther"
    | "decimal"
    | "presets"
    | "unitOptions"
    | "learn"
  >
> & {
  hidden?: boolean;
  required?: boolean;
  description?: string;
  defaultStatus?: FieldStatus;
  acceptsNote?: boolean;
  acceptsPhoto?: boolean;
  acceptsDoc?: boolean;
  acceptsAudio?: boolean;
  acceptsCoords?: boolean;
  canBePending?: boolean;
  canBeNA?: boolean;
  inExport?: boolean;
  inReport?: boolean;
  active?: boolean;
};

/** Patch parcial aplicado sobre um subgrupo de fábrica. */
export interface SubgroupPatch {
  title?: string;
  description?: string;
  hidden?: boolean;
  /** Reordenação dos campos existentes (ids). */
  fieldOrder?: string[];
  defaultNA?: boolean;
}

/** Patch aplicado sobre um módulo (visualização/ordenação). */
export interface ModulePatch {
  title?: string;
  description?: string;
  /** Ordem desejada dos subgrupos (ids, incluindo customizados). */
  subgroupOrder?: string[];
}

/** Customizações persistidas pelo usuário sobre o catálogo de módulos. */
export interface FormStructureOverrides {
  /** chaves: `${moduleId}` */
  modules?: Record<string, ModulePatch>;
  /** chaves: `${moduleId}.${subgroupId}` */
  subgroups?: Record<string, SubgroupPatch>;
  /** chaves: `${moduleId}.${subgroupId | "_"}.${fieldId}` */
  fields?: Record<string, FieldPatch>;
  /** Subgrupos novos adicionados pelo usuário, por moduleId. */
  customSubgroups?: Record<string, SubgroupDef[]>;
  /** Campos novos adicionados, por `${moduleId}.${subgroupId}`. */
  customFields?: Record<string, FieldDef[]>;
  /** Cores por entidade (chaves: `mod`, `mod.sub`, `mod.sub.field`). */
  colors?: Record<string, string>;
}

/* ============ Tipos de levantamento personalizados ============ */

export type ModuleRequirement = "obrigatorio" | "recomendado" | "opcional";

export interface CustomTypeModuleBinding {
  moduleId: string;
  requirement: ModuleRequirement;
  color?: string;
}

export interface CustomSurveyType {
  id: string;            // ex.: custom_xxx
  label: string;
  description?: string;
  sourceTypeId?: SurveyType;
  color?: string;        // cor base do tipo
  icon?: string;         // nome de ícone lucide (ex.: "Droplet")
  moduleBindings: CustomTypeModuleBinding[];
  /** Overrides escopados ao tipo. Mesma forma de FormStructureOverrides. */
  scopedOverrides?: FormStructureOverrides;
  createdAt: string;
  archivedAt?: string;
  /** Tipo desativado: oculto na criação de novos levantamentos, mas mantém os existentes. */
  inactive?: boolean;
}
