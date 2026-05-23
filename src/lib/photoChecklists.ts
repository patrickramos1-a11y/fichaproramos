import type { SurveyType } from "./types";

export type PhotoChecklistKey =
  | "projeto"
  | "acompanhamento"
  | "outorga"
  | "vazao"
  | "visita_terreno"
  | "obras"
  | "documentos_fisicos"
  | "post";

export interface PhotoChecklistItem {
  /** slug local (sem o prefixo do template). */
  id: string;
  label: string;
}

export interface PhotoChecklistTemplate {
  key: PhotoChecklistKey;
  title: string;
  items: PhotoChecklistItem[];
}

function mk(items: string[]): PhotoChecklistItem[] {
  return items.map((label) => ({
    id: label
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, ""),
    label,
  }));
}

export const PHOTO_CHECKLISTS: Record<PhotoChecklistKey, PhotoChecklistTemplate> = {
  projeto: {
    key: "projeto",
    title: "Levantamento de Projeto",
    items: mk([
      "Fachada / entrada da empresa",
      "Placa ou identificação do empreendimento",
      "Vista geral do empreendimento",
      "Galpão / área produtiva",
      "Processo produtivo",
      "Equipamentos",
      "Matéria-prima",
      "Produto acabado",
      "Produtos químicos",
      "Frota de veículos",
      "Área de resíduos sólidos",
      "Lixeiras / coletores",
      "Efluentes / ponto de geração",
      "Sistema de tratamento / ETE",
      "Corpo hídrico receptor",
      "Poço",
      "Bomba do poço",
      "Reservatório de água",
      "Hidrômetro",
      "Entorno da empresa",
      "Acesso ao empreendimento",
      "Documentos físicos",
    ]),
  },
  acompanhamento: {
    key: "acompanhamento",
    title: "Acompanhamento Ambiental",
    items: mk([
      "Foto geral da empresa",
      "Política ambiental / avisos",
      "Coletores / lixeiras",
      "Área de armazenamento de resíduos",
      "Resíduo não conforme",
      "Coleta de resíduos",
      "ETE",
      "Problema na ETE",
      "Produtos utilizados na ETE",
      "Poço",
      "Reservatório",
      "Hidrômetro / tabela de leitura",
      "Coleta de água",
      "Coleta de efluente",
      "Documento entregue ou recebido",
      "Pendência ambiental identificada",
      "Antes/depois de correção",
    ]),
  },
  outorga: {
    key: "outorga",
    title: "Outorga",
    items: mk([
      "Vista geral do empreendimento",
      "Poço",
      "Boca / tampa do poço",
      "Entorno do poço",
      "Bomba do poço",
      "Placa / identificação da bomba",
      "Quadro elétrico da bomba",
      "Tubulação",
      "Hidrômetro / medidor",
      "Reservatório",
      "Ponto de uso da água",
      "Documento técnico",
    ]),
  },
  vazao: {
    key: "vazao",
    title: "Medição de Vazão",
    items: mk([
      "Ponto de medição",
      "Vista geral da seção",
      "Montante",
      "Jusante",
      "Largura da seção",
      "Medição de profundidade",
      "Medição de tempo / velocidade",
      "Equipamento utilizado",
      "Condição da água",
      "Obstruções no ponto",
      "Croqui da seção",
    ]),
  },
  visita_terreno: {
    key: "visita_terreno",
    title: "Visita ao Local / Terreno",
    items: mk([
      "Frente do terreno",
      "Fundos do terreno",
      "Lado direito",
      "Lado esquerdo",
      "Vista panorâmica do terreno",
      "Limites do terreno",
      "Topografia / desnível",
      "Córrego",
      "Nascente",
      "Poço no terreno",
      "Área úmida / aluvião",
      "Construções existentes",
      "Resíduos no terreno",
      "Vegetação",
      "Solo",
      "Acesso ao terreno",
      "Infraestrutura pública",
      "Vizinhança",
      "Obras próximas",
      "Croqui do local",
    ]),
  },
  obras: {
    key: "obras",
    title: "Acompanhamento de Obras",
    items: mk([
      "Placa da obra",
      "Vista geral da obra",
      "Frente de serviço",
      "Área construída atual",
      "Escavação / terraplenagem",
      "Estrutura / concretagem",
      "Drenagem",
      "Armazenamento de materiais",
      "Resíduos da obra",
      "Interferência ambiental",
      "Vizinhança impactada",
      "Acesso de máquinas e caminhões",
      "Antes da intervenção",
      "Depois da intervenção",
      "Não conformidade",
      "Correção realizada",
    ]),
  },
  documentos_fisicos: {
    key: "documentos_fisicos",
    title: "Documentos Físicos",
    items: mk(["Documentos físicos"]),
  },
  post: {
    key: "post",
    title: "Post / Comunicação",
    items: mk([
      "Técnico em campo",
      "Equipe em campo",
      "Técnico usando o aplicativo",
      "Medição sendo realizada",
      "Cliente acompanhando",
      "Bastidores da visita",
      "Detalhe técnico educativo",
      "Antes/depois",
      "Resultado visual",
      "Foto horizontal institucional",
      "Foto vertical para stories",
    ]),
  },
};

/** Mapeamento padrão de SurveyType (builtin) → templates aplicáveis. */
export const DEFAULT_TEMPLATES_BY_SURVEY_TYPE: Record<string, PhotoChecklistKey[]> = {
  geral: ["projeto"],
  ambiental: ["acompanhamento"],
  outorga: ["outorga"],
  vazao: ["vazao"],
  terreno: ["visita_terreno"],
};

export function defaultTemplateKeysFor(type: SurveyType): PhotoChecklistKey[] {
  return DEFAULT_TEMPLATES_BY_SURVEY_TYPE[type] ?? ["projeto"];
}

/** Compõe um itemId estável: "<templateKey>.<itemId local>". */
export function composeItemId(templateKey: PhotoChecklistKey, itemId: string): string {
  return `${templateKey}.${itemId}`;
}

export const ALL_TEMPLATE_KEYS: PhotoChecklistKey[] = Object.keys(
  PHOTO_CHECKLISTS,
) as PhotoChecklistKey[];