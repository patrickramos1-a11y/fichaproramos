import type { FieldDef, ModuleDef, SurveyType, ModulePurpose } from "./types";
import type {
  FieldStatus, ModuleState, SubgroupDef, Person, HoursValue,
  FormStructureOverrides, CustomSurveyType,
} from "./types";
import { PHOTO_CHECKLISTS, ALL_TEMPLATE_KEYS } from "./photoChecklists";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const SIM_NAO_PARCIAL_AVALIADO = ["Sim", "Não", "Parcialmente", "Não avaliado"];
const SIM_NAO_PARCIAL_NA = ["Sim", "Não", "Parcialmente", "Não avaliado", "Não se aplica"];
const SIM_NAO_NA = ["Sim", "Não", "Não avaliado", "Não se aplica"];
const CONDICOES_CLIMATICAS_OBRA = ["Ensolarado", "Nublado", "Chuvoso", "Pós-chuva", "Solo úmido", "Não avaliado"];
const TIPOS_VISITA_OBRA = [
  "Visita semanal", "Vistoria pontual", "Verificação de pendência", "Registro de avanço",
  "Reunião em obra", "Verificação de não conformidade", "Encerramento de pendências", "Outro",
];
const STATUS_OBRA = [
  "Não iniciada", "Em andamento", "Paralisada", "Atrasada", "Parcialmente concluída", "Concluída",
  "Aguardando material", "Aguardando equipe", "Aguardando definição do cliente", "Aguardando órgão público", "Outro",
];
const FASES_OBRA = [
  "Mobilização", "Limpeza/preparação da área", "Terraplenagem", "Fundação", "Estrutura", "Alvenaria",
  "Cobertura", "Instalações hidráulicas", "Instalações elétricas", "Acabamento", "Área externa", "Drenagem",
  "Paisagismo/recuperação", "Testes/comissionamento", "Correções finais", "Outro",
];
const TIPOS_RESIDUOS_OBRA = [
  "Entulho", "Solo", "Madeira", "Plástico", "Papel/papelão", "Metal", "Embalagens",
  "Resíduos orgânicos", "Resíduos perigosos", "Resíduos contaminados", "Outros",
];
const TIPOS_NAO_CONFORMIDADE_OBRA = [
  "Resíduos", "Organização", "Segurança", "Erosão/sedimentos", "Água/drenagem", "Efluentes",
  "Poeira/ruído", "Documentação", "Intervenção ambiental", "Armazenamento inadequado", "Falta de sinalização", "Outro",
];
const GRAVIDADES_OBRA = ["Baixa", "Média", "Alta", "Crítica"];
const PRIORIDADES_OBRA = ["Baixa", "Média", "Alta", "Urgente"];
const STATUS_PENDENCIA_OBRA = ["Aberta", "Em andamento", "Aguardando cliente", "Aguardando equipe", "Aguardando material", "Corrigida", "Cancelada"];
const SITUACOES_FINAIS_OBRA = [
  "Visita concluída sem pendências", "Visita concluída com pendências", "Visita parcial", "Necessário retorno",
  "Aguardando informações", "Aguardando cliente", "Aguardando equipe", "Outro",
];
const VINCULOS_FOTO_OBRA = [
  "Avanço da obra", "Pendência", "Não conformidade", "Correção", "Resíduos", "Drenagem/água",
  "Organização", "Segurança", "Registro geral", "Outro",
];

export const MODULES: ModuleDef[] = [
  {
    id: "identificacao",
    title: "Identificação do Levantamento",
    description: "Contexto da visita: data, horários, motivo e objetivo.",
    fields: [],
    purposes: ["projeto", "acompanhamento", "monitoramento", "outorga", "vazao"],
    subgroups: [
      {
        id: "visita",
        title: "Dados da visita",
        fields: [
          { id: "data_visita", label: "Data da visita", type: "date" },
          { id: "hora_chegada", label: "Horário de chegada", type: "time" },
          { id: "objetivo", label: "Objetivo da visita", type: "textarea" },
        ],
      },
      {
        id: "motivo",
        title: "Motivo da visita",
        fields: [
          { id: "motivo", label: "Motivo (pode marcar mais de um)", type: "multiselect", options: ["Fiscalização", "Levantamento de projetos", "Visita técnica", "Reunião", "Outro"] },
          { id: "motivo_outro", label: "Descreva o outro motivo", type: "text", showIf: { field: "motivo", in: ["Outro"] } },
        ],
      },
      {
        id: "local",
        title: "Identificação do local",
        description: "Confirme dados do local visitado (podem diferir do cadastro do empreendimento).",
        fields: [
          { id: "local_nome", label: "Nome do local / empreendimento", type: "text" },
          { id: "local_endereco", label: "Endereço", type: "text" },
          { id: "local_bairro", label: "Bairro", type: "text" },
          { id: "local_cidade", label: "Cidade", type: "text" },
          { id: "local_uf", label: "UF", type: "select", options: UFS },
          { id: "local_cep", label: "CEP", type: "text" },
        ],
      },
    ],
  },
  {
    id: "empreendimento",
    title: "Dados Cadastrais do Empreendimento",
    description: "Confirme/complete os dados cadastrais utilizados neste levantamento.",
    fields: [],
    purposes: ["projeto", "acompanhamento", "outorga"],
    subgroups: [
      {
        id: "identificacao_empresa",
        title: "Identificação da empresa",
        fields: [
          { id: "empresa", label: "Empresa / empreendimento", type: "text" },
          { id: "cnpj_cpf", label: "CNPJ / CPF", type: "text" },
          { id: "ie", label: "Inscrição Estadual", type: "text" },
          { id: "im", label: "Inscrição Municipal", type: "text" },
          { id: "atividade", label: "Descrição da atividade", type: "textarea" },
          { id: "cnae", label: "CNAE", type: "text" },
        ],
      },
      {
        id: "endereco",
        title: "Endereço",
        fields: [
          { id: "endereco", label: "Endereço (logradouro, nº, complemento)", type: "text" },
          { id: "bairro", label: "Bairro", type: "text" },
          { id: "cidade", label: "Cidade", type: "text" },
          { id: "uf", label: "UF", type: "select", options: UFS },
          { id: "cep", label: "CEP", type: "text" },
        ],
      },
      {
        id: "coords_emp",
        title: "Coordenadas geográficas do empreendimento",
        fields: [
          { id: "coord_emp", label: "Coordenadas (latitude / longitude)", type: "coords" },
        ],
      },
      {
        id: "contato_local",
        title: "Contato no local",
        fields: [
          { id: "contatos_local", label: "Contatos no local", type: "people" },
        ],
      },
      {
        id: "rep_legal",
        title: "Representante legal",
        fields: [
          { id: "rep_nome", label: "Nome do representante legal", type: "text" },
          { id: "rep_rg", label: "RG", type: "text" },
          { id: "rep_cpf", label: "CPF", type: "text" },
          { id: "rep_cargo", label: "Cargo", type: "text" },
          { id: "rep_endereco", label: "Endereço do representante", type: "text" },
          { id: "rep_telefone", label: "Telefone", type: "text" },
          { id: "rep_email", label: "E-mail", type: "text" },
        ],
      },
    ],
  },
  {
    id: "pessoas",
    title: "Pessoas Envolvidas",
    description: "Pessoas que participaram desta visita.",
    fields: [],
    purposes: ["projeto", "acompanhamento", "monitoramento", "outorga", "vazao"],
    subgroups: [
      {
        id: "colaborador",
        title: "Colaborador que acompanhou o levantamento",
        fields: [
          { id: "colaboradores", label: "Colaboradores que acompanharam", type: "people" },
        ],
      },
      {
        id: "tecnico",
        title: "Técnico responsável pelo levantamento",
        fields: [
          { id: "tecnicos", label: "Técnico(s) responsável(eis)", type: "people" },
        ],
      },
      {
        id: "outros",
        title: "Outras pessoas presentes",
        fields: [
          { id: "outros_pessoas", label: "Outras pessoas presentes", type: "people" },
        ],
      },
    ],
  },
  {
    id: "localizacao",
    title: "Localização e Coordenadas",
    description: "Coordenadas do empreendimento e captura de pontos, linhas e polígonos com GPS de alta precisão.",
    fields: [],
    subgroups: [
      {
        id: "coordenadas",
        title: "Coordenadas do empreendimento",
        fields: [
          { id: "coord_emp", label: "Coordenadas (latitude / longitude)", type: "coords" },
        ],
      },
      {
        id: "pontos",
        title: "Pontos GPS",
        description: "Pontos individuais capturados com GPS estabilizado.",
        fields: [
          { id: "pontos_gps", label: "Pontos capturados", type: "geometries" },
        ],
        optional: true,
      },
      {
        id: "linhas",
        title: "Linhas / Trajetos",
        description: "Cercas, ruas, divisas, trajetos hidráulicos.",
        fields: [
          { id: "linhas_gps", label: "Linhas capturadas", type: "geometries" },
        ],
        optional: true,
      },
      {
        id: "poligonos",
        title: "Polígonos / Áreas",
        description: "Talhões, áreas construídas, lagoas, APP.",
        fields: [
          { id: "poligonos_gps", label: "Polígonos capturados", type: "geometries" },
        ],
        optional: true,
      },
    ],
  },
  {
    id: "operacionais",
    title: "Dados Operacionais",
    description: "Funcionamento, equipe e alterações operacionais.",
    fields: [],
    purposes: ["projeto", "acompanhamento", "monitoramento", "outorga"],
    subgroups: [
      {
        id: "funcionamento",
        title: "Funcionamento",
        fields: [
          { id: "funcionamento", label: "Regime de funcionamento", type: "hours-presets" },
        ],
      },
      {
        id: "quadro",
        title: "Quadro de funcionários",
        fields: [
          { id: "total_colaboradores", label: "Total de colaboradores (sem detalhamento por setor)", type: "number", decimal: false },
          {
            id: "setores",
            label: "Setores e quantidade de funcionários",
            type: "repeater",
            addItemLabel: "Adicionar setor",
            itemFields: [
              { id: "setor", label: "Setor", type: "button-select", options: ["Administrativo", "Operacional", "Produção", "Manutenção", "Limpeza", "Segurança", "Logística", "Expedição", "Comercial", "Financeiro", "RH", "TI", "Outros"], allowOther: true, learn: true },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
            ],
          },
        ],
      },
      {
        id: "producao",
        title: "Produção e operação",
        fields: [
          { id: "capacidade_produtiva", label: "Capacidade produtiva atual", type: "text" },
        ],
      },
    ],
  },
  {
    id: "areas",
    title: "Áreas, Dimensões e Terreno",
    description: "Áreas do empreendimento e características físicas do terreno.",
    fields: [],
    purposes: ["projeto"],
    subgroups: [
      {
        id: "areas_empreendimento",
        title: "Áreas do empreendimento",
        fields: [
          { id: "area_total", label: "Área total", type: "number", unitOptions: ["m²", "ha"], presets: [100, 250, 500, 1000, 5000, 10000], suggestFrom: { kind: "areaFromDims" } },
          { id: "area_construida", label: "Área construída", type: "number", unit: "m²", presets: [50, 100, 250, 500, 1000] },
          { id: "area_a_construir", label: "Área a construir", type: "number", unit: "m²", presets: [50, 100, 250, 500, 1000] },
          { id: "area_livre", label: "Área livre / não edificada", type: "number", unit: "m²", presets: [50, 100, 250, 500, 1000] },
        ],
      },
      {
        id: "dimensoes",
        title: "Dimensões do terreno",
        description: "Posicionando-se de frente para o terreno.",
        fields: [
          { id: "dim_frente", label: "Frente", type: "number", unit: "m" },
          { id: "dim_fundos", label: "Fundos", type: "number", unit: "m" },
          { id: "dim_lado_dir", label: "Lado direito", type: "number", unit: "m" },
          { id: "dim_lado_esq", label: "Lado esquerdo", type: "number", unit: "m" },
          { id: "regularidade", label: "Possui regularidade geométrica?", type: "boolean" },
        ],
      },
      {
        id: "limites",
        title: "Limites do terreno (fechamento)",
        fields: [
          {
            id: "limites",
            label: "Tipo de fechamento por lado",
            type: "apply-to-sides",
            sides: ["Frente", "Fundos", "Lado direito", "Lado esquerdo"],
            options: ["Cerca", "Muro de alvenaria", "Muro de concreto", "Tela", "Inexistente", "Outro"],
          },
        ],
      },
      {
        id: "topografia",
        title: "Conformação / Topografia",
        fields: [
          { id: "topografia", label: "Conformação predominante", type: "button-select", options: ["Plano", "Aclive suave", "Aclive acentuado", "Declive suave", "Declive acentuado", "Irregular"] },
          { id: "desnivel", label: "Desnível frente–fundo", type: "number", unit: "m" },
        ],
      },
      {
        id: "solo_vegetacao",
        title: "Solo",
        fields: [
          { id: "tipo_solo", label: "Tipo de solo", type: "button-select", multi: true, allowOther: true, learn: true, options: ["Arenoso", "Argiloso", "Siltoso", "Pedregoso", "Misto", "Aterro", "Rocha exposta", "Solo degradado", "Solo não degradado", "Solo com construção", "Solo com vegetação", "Solo compactado", "Solo exposto", "Contaminado"] },
        ],
      },
      {
        id: "vegetacao",
        title: "Vegetação",
        fields: [
          { id: "vegetacao", label: "Identificação da vegetação", type: "button-select", multi: true, allowOther: true, options: ["Vegetação presente", "Ausência de vegetação", "Degradada", "Preservada", "Antropizada", "Capoeira", "Árvores isoladas", "Rasteira", "Arbustiva", "Arbórea"] },
        ],
      },
      {
        id: "obstrucoes",
        title: "Obstruções naturais",
        fields: [
          { id: "obstrucoes", label: "Obstruções identificadas", type: "button-select", multi: true, allowOther: true, options: ["Córrego", "Nascente", "Poço", "Aluvião", "Pedras", "Talude", "Lago/Açude", "Mata ciliar"] },
        ],
      },
      {
        id: "construcoes",
        title: "Construções existentes",
        fields: [
          {
            id: "construcoes",
            label: "Construções existentes",
            type: "repeater",
            addItemLabel: "Adicionar construção",
            itemFields: [
              { id: "tipo", label: "Tipo", type: "button-select", allowOther: true, learn: true, options: ["Galpão", "Sede", "Poço", "Barragem", "Curral", "Caixa d'água", "Escritório", "Depósito", "Área coberta", "Banheiro", "Casa", "Muro", "Cerca"] },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
              { id: "area", label: "Área aproximada", type: "number", unit: "m²" },
            ],
          },
        ],
      },
      {
        id: "entorno",
        title: "Entorno",
        fields: [
          { id: "entorno_categorias", label: "Caracterização do entorno", type: "button-select", multi: true, allowOther: true, learn: true, options: ["Arborizado", "Vegetação nativa", "Antropizado / urbanizado", "Industrial", "Rural", "Comercial", "Residencial", "Margem de corpo hídrico", "Próximo a APP", "Próximo a unidade de conservação", "Área degradada", "Pasto / agricultura"] },
          { id: "entorno_obs", label: "Observações sobre o entorno", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "agua",
    title: "Água, Captação, Reservatório e Uso",
    description: "Fontes, consumo, reservatório, uso da água e situação de outorga.",
    fields: [],
    purposes: ["projeto", "outorga", "monitoramento"],
    subgroups: [
      {
        id: "corpo_hidrico",
        title: "Corpo hídrico",
        fields: [
          { id: "corpo_hidrico", label: "Existe corpo hídrico receptor?", type: "button-select", options: ["Sim", "Não"] },
          { id: "nascente", label: "Há nascente?", type: "button-select", options: ["Sim", "Não"], showIf: { field: "corpo_hidrico", equals: "Sim" } },
          { id: "nascente_coords", label: "Coordenadas da nascente", type: "coords", showIf: { field: "nascente", equals: "Sim" } },
          { id: "corpo_hidrico_desc", label: "Identificação (nome / tipo)", type: "text", showIf: { field: "corpo_hidrico", equals: "Sim" } },
          { id: "distancia_corpo", label: "Distância do corpo hídrico", type: "number", unit: "m", showIf: { field: "corpo_hidrico", equals: "Sim" } },
          { id: "dentro_propriedade", label: "Localização", type: "button-select", options: ["Dentro da propriedade", "Fora da propriedade"], showIf: { field: "corpo_hidrico", equals: "Sim" } },
        ],
      },
      {
        id: "captacao",
        title: "Captação de água",
        fields: [
          { id: "tipo_captacao", label: "Tipo(s) de captação", type: "button-select", multi: true, allowOther: true, learn: true, options: ["Superficial", "Subterrânea", "Rede pública", "Caminhão pipa", "Reuso"] },
          { id: "fornecedor_publico", label: "Concessionária (se rede pública)", type: "text", showIf: { field: "tipo_captacao", in: ["Rede pública"] } },
          {
            id: "pontos_captacao",
            label: "Pontos de captação",
            type: "repeater",
            addItemLabel: "Adicionar ponto de captação",
            itemFields: [
              { id: "tipo", label: "Tipo", type: "button-select", allowOther: true, learn: true, options: ["Poço", "Rio", "Nascente", "Açude", "Cisterna", "Rede pública", "Caminhão pipa", "Reuso"] },
              { id: "nome", label: "Identificação do ponto (opcional)", type: "text", enterToAdd: true },
              { id: "coords", label: "Coordenadas", type: "coords" },
              { id: "consumo", label: "Estimativa de consumo", type: "number", unit: "m³/dia", presets: [1, 5, 10, 20, 50, 100, 500] },
            ],
            noPresetMemory: true,
          },
        ],
      },
      {
        id: "reservatorio",
        title: "Reservatório de água",
        fields: [
          { id: "tem_reservatorio", label: "Possui reservatório?", type: "button-select", options: ["Sim", "Não"] },
          {
            id: "reservatorios",
            label: "Reservatórios",
            type: "repeater",
            addItemLabel: "Adicionar reservatório",
            showIf: { field: "tem_reservatorio", equals: "Sim" },
            itemFields: [
              { id: "tipo", label: "Tipo", type: "button-select", allowOther: true, learn: true, options: ["Caixa elevada", "Cisterna", "Tanque", "Reservatório de fibra", "Reservatório metálico"] },
              { id: "capacidade", label: "Capacidade", type: "number", unit: "L", presets: [500, 1000, 2000, 5000, 10000, 20000] },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
            ],
          },
        ],
      },
      {
        id: "uso",
        title: "Uso da água",
        fields: [
          {
            id: "consumo_por_uso",
            label: "Usos da água e estimativa de consumo",
            type: "repeater",
            addItemLabel: "Adicionar uso",
            itemFields: [
              { id: "uso", label: "Tipo de uso", type: "button-select", allowOther: true, learn: true, options: ["Consumo humano", "Sanitário", "Processo industrial", "Limpeza", "Irrigação", "Resfriamento", "Dessedentação animal", "Lavagem de veículos", "Combate a incêndio"] },
              { id: "consumo_dia", label: "Estimativa por dia", type: "number", unit: "m³/dia", presets: [0.5, 1, 5, 10, 20, 50] },
            ],
          },
        ],
      },
      {
        id: "outorga_situacao",
        title: "Situação de outorga",
        fields: [
          { id: "outorga_status", label: "Situação", type: "button-select", options: ["Outorga", "Dispensa de outorga", "Não possui", "Em andamento"] },
          { id: "outorga_numero", label: "Número da outorga / processo", type: "text" },
          { id: "outorga_validade", label: "Validade da outorga", type: "date" },
        ],
      },
    ],
  },
  {
    id: "pocos",
    title: "Poços",
    description: "Dados técnicos do poço, bomba, captação e uso.",
    fields: [],
    purposes: ["outorga", "vazao", "monitoramento"],
    subgroups: [
      {
        id: "coords_poco",
        title: "Coordenadas do poço",
        fields: [
          { id: "coord_poco", label: "Coordenadas (latitude / longitude)", type: "coords" },
        ],
      },
      {
        id: "caracteristicas",
        title: "Características do poço",
        fields: [
          { id: "profundidade", label: "Profundidade", type: "number", unit: "m" },
          { id: "diametro", label: "Diâmetro", type: "number", unit: "mm" },
          { id: "nivel_estatico", label: "Nível estático", type: "number", unit: "m" },
          { id: "nivel_dinamico", label: "Nível dinâmico", type: "number", unit: "m" },
          { id: "poco_obs", label: "Observações do poço", type: "textarea" },
        ],
      },
      {
        id: "bomba",
        title: "Dados da bomba",
        fields: [
          { id: "bomba_cv", label: "Potência (CV)", type: "number", unit: "CV" },
          { id: "bomba_marca", label: "Marca", type: "text" },
          { id: "bomba_modelo", label: "Modelo", type: "text" },
        ],
      },
      {
        id: "vazao_captacao",
        title: "Captação e vazão",
        fields: [
          { id: "vazao_poco", label: "Vazão produzida pelo poço", type: "number", unit: "m³/h" },
          { id: "vazao_requerida", label: "Vazão requerida/dia", type: "number", unit: "m³/dia" },
          { id: "tempo_captacao", label: "Tempo de captação", type: "number", unit: "h/dia" },
        ],
      },
    ],
  },
  {
    id: "vazao",
    title: "Medição de Vazão",
    description: "Registro técnico da seção: largura, comprimento, profundidades e tempos.",
    fields: [],
    purposes: ["vazao"],
    subgroups: [
      {
        id: "dados_medicao",
        title: "Dados da medição",
        fields: [
          { id: "data_medicao", label: "Data da visita", type: "date" },
          { id: "hora_chegada_med", label: "Horário de chegada", type: "time" },
          { id: "hora_saida_med", label: "Horário de saída", type: "time" },
          { id: "objetivo_medicao", label: "Objetivo da visita", type: "textarea" },
        ],
      },
      {
        id: "descricao_tecnica",
        title: "Descrição técnica",
        fields: [
          { id: "descricao_assuntos", label: "Descrição dos assuntos abordados", type: "textarea" },
        ],
      },
      {
        id: "largura",
        title: "Largura da seção",
        fields: [
          { id: "largura_inicio", label: "Largura no início", type: "number", unit: "m" },
          { id: "largura_meio", label: "Largura no meio", type: "number", unit: "m" },
          { id: "largura_fim", label: "Largura no fim", type: "number", unit: "m" },
        ],
      },
      {
        id: "comprimento_area",
        title: "Comprimento e área",
        fields: [
          { id: "comprimento", label: "Comprimento", type: "number", unit: "m" },
          { id: "area_secao", label: "Área da seção", type: "number", unit: "m²", suggestFrom: { kind: "areaFromVazao" } },
        ],
      },
      {
        id: "prof_inicio",
        title: "Profundidades no início",
        fields: [
          { id: "p1", label: "P1", type: "number", unit: "m" },
          { id: "p2", label: "P2", type: "number", unit: "m" },
          { id: "p3", label: "P3", type: "number", unit: "m" },
        ],
      },
      {
        id: "prof_meio",
        title: "Profundidades no meio",
        fields: [
          { id: "p4", label: "P4", type: "number", unit: "m" },
          { id: "p5", label: "P5", type: "number", unit: "m" },
          { id: "p6", label: "P6", type: "number", unit: "m" },
        ],
      },
      {
        id: "prof_fim",
        title: "Profundidades no fim",
        fields: [
          { id: "p7", label: "P7", type: "number", unit: "m" },
          { id: "p8", label: "P8", type: "number", unit: "m" },
          { id: "p9", label: "P9", type: "number", unit: "m" },
        ],
      },
      {
        id: "tempos",
        title: "Velocidade / Tempo",
        fields: [
          { id: "t1", label: "T1", type: "number", unit: "s" },
          { id: "t2", label: "T2", type: "number", unit: "s" },
          { id: "t3", label: "T3", type: "number", unit: "s" },
          { id: "t4", label: "T4", type: "number", unit: "s" },
          { id: "t5", label: "T5", type: "number", unit: "s" },
        ],
      },
      {
        id: "croqui",
        title: "Croqui / Desenho",
        fields: [
          { id: "croqui_descricao", label: "Descrição do desenho da seção", type: "textarea" },
          { id: "croqui_obs", label: "Observações sobre o croqui", type: "textarea" },
        ],
      },
      {
        id: "obs",
        title: "Observações",
        fields: [
          { id: "obs_vazao", label: "Observações técnicas da medição", type: "textarea" },
        ],
      },
      {
        id: "validacao_vazao",
        title: "Validação",
        fields: [
          { id: "assinatura_resp_tecnico", label: "Responsável técnico (assinatura)", type: "text" },
          { id: "assinatura_rep_empresa", label: "Representante da empresa (assinatura)", type: "text" },
        ],
      },
    ],
  },
  {
    id: "outorga",
    title: "Outorga (dados específicos)",
    description: "Dados complementares para o processo de outorga.",
    fields: [],
    purposes: ["outorga"],
    subgroups: [
      {
        id: "situacao",
        title: "Situação do processo",
        fields: [
          { id: "outorga_situacao", label: "Situação atual", type: "select", options: ["Não iniciado", "Em elaboração", "Protocolado", "Concedido", "Renovação", "Indeferido"] },
          { id: "outorga_orgao", label: "Órgão responsável", type: "text" },
          { id: "outorga_protocolo", label: "Nº protocolo / processo", type: "text" },
          { id: "outorga_data_protocolo", label: "Data de protocolo", type: "date" },
          { id: "outorga_validade", label: "Validade", type: "date" },
        ],
      },
      {
        id: "finalidade",
        title: "Finalidade da outorga",
        fields: [
          { id: "finalidade", label: "Finalidade do uso", type: "multiselect", options: ["Abastecimento humano", "Industrial", "Irrigação", "Dessedentação animal", "Lançamento de efluentes", "Outro"] },
          { id: "finalidade_obs", label: "Detalhamento da finalidade", type: "textarea" },
        ],
      },
      {
        id: "captacao_outorga",
        title: "Captação solicitada",
        fields: [
          { id: "vazao_solicitada", label: "Vazão solicitada", type: "number", unit: "m³/h" },
          { id: "volume_diario", label: "Volume diário", type: "number", unit: "m³/dia" },
          { id: "tempo_diario", label: "Tempo de captação diário", type: "number", unit: "h/dia" },
          { id: "dias_mes", label: "Dias de captação por mês", type: "number" },
        ],
      },
      {
        id: "obs_outorga",
        title: "Observações",
        fields: [
          { id: "outorga_obs", label: "Observações gerais", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "ete",
    title: "ETE e Efluentes",
    description: "Estação de Tratamento de Efluentes: existência, operação, produtos e treinamento.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento", "projeto"],
    subgroups: [
      {
        id: "existencia",
        title: "Existência da ETE",
        fields: [
          { id: "possui_ete", label: "Possui ETE?", type: "button-select", options: ["Tem ETE", "Não tem ETE", "Esperando obra", "Esperando reforma", "Em projeto"] },
        ],
      },
      {
        id: "operacao",
        title: "Operação da ETE",
        description: "Preencher se possui ETE.",
        fields: [
          { id: "problema_ete", label: "Algum problema na operação da ETE?", type: "button-select", options: ["Sim", "Não", "Não se aplica"] },
          { id: "problema_ete_desc", label: "Descrição do problema", type: "textarea", showIf: { field: "problema_ete", equals: "Sim" } },
          { id: "funcionamento_ete", label: "Funcionamento da ETE", type: "button-select", options: ["Adequado", "Com problemas", "Parada"] },
        ],
      },
      {
        id: "produtos",
        title: "Produtos utilizados na ETE",
        fields: [
          {
            id: "produtos_ete_lista",
            label: "Produtos utilizados",
            type: "repeater",
            addItemLabel: "Adicionar produto",
            itemFields: [
              { id: "nome", label: "Produto", type: "button-select", allowOther: true, options: ["Cloro em pó", "Cal", "Alcalinizante", "Coagulante", "Floculante", "Reagente biológico", "Não utiliza"] },
              { id: "quantidade", label: "Quantidade / dose", type: "text" },
            ],
          },
        ],
      },
      {
        id: "treinamento",
        title: "Treinamento de operador",
        fields: [
          { id: "treinamento_ete", label: "Há necessidade de treinar um novo operador?", type: "button-select", options: ["Sim", "Não", "Não se aplica ainda"] },
        ],
      },
      {
        id: "tratamento_efluentes",
        title: "Tratamento de efluentes",
        fields: [
          { id: "ha_tratamento", label: "Há tratamento de efluentes?", type: "button-select", options: ["Sim", "Não", "Precisará de projeto", "Não está funcionando"] },
          { id: "tipo_efluente", label: "Tipo de efluente", type: "button-select", multi: true, allowOther: true, options: ["Industrial", "Doméstico", "ETE", "Fossa séptica", "Sumidouro", "Reuso", "Lançamento em corpo hídrico", "Rede pública"] },
        ],
      },
    ],
  },
  {
    id: "emissoes",
    title: "Emissões",
    description: "Ruídos, emissões líquidas, sólidas e gasosas.",
    fields: [],
    purposes: ["projeto", "acompanhamento"],
    subgroups: [
      {
        id: "ruidos",
        title: "Ruídos",
        fields: [
          { id: "ruidos_status", label: "Situação", type: "button-select", options: ["Houve teste", "Falta fazer", "Não se aplica"] },
        ],
      },
      {
        id: "liquidos",
        title: "Emissões líquidas",
        fields: [
          { id: "tipo_efluente_liquido", label: "Tipo de efluente líquido", type: "button-select", multi: true, allowOther: true, options: ["Industrial", "Doméstico", "ETE", "Fossa séptica", "Sumidouro", "Rede pública", "Reuso"] },
          { id: "volume_liquido", label: "Volume estimado", type: "number", unit: "m³/dia", presets: [0.5, 1, 5, 10, 20, 50, 100], showIf: { field: "tipo_efluente_liquido", truthy: true } },
        ],
      },
      {
        id: "solidos",
        title: "Geração de resíduos",
        fields: [
          { id: "destinacao_solidos", label: "Destinação dos sólidos", type: "button-select", multi: true, allowOther: true, options: ["Coleta pública", "Empresa terceirizada", "Mistura com demais resíduos", "Reciclagem", "Aterro próprio", "Compostagem"] },
        ],
      },
      {
        id: "gasosos",
        title: "Emissões gasosas",
        fields: [
          { id: "emissao_gasosa", label: "Existência de emissão gasosa", type: "button-select", multi: true, options: ["Há chaminé", "Há emissão difusa", "Vapor", "Material particulado", "Não se aplica"] },
          { id: "tem_filtro", label: "Há filtro?", type: "button-select", options: ["Sim", "Não", "Não se aplica"] },
          { id: "tem_lavador", label: "Há lavador de fumaça?", type: "button-select", options: ["Sim", "Não", "Não se aplica"] },
        ],
      },
    ],
  },
  {
    id: "processo",
    title: "Processo Produtivo",
    description: "Levantamento técnico: matéria-prima, equipamentos, etapas, químicos e frota.",
    fields: [],
    purposes: ["projeto"],
    subgroups: [
      {
        id: "materia_prima",
        title: "Matéria-prima",
        fields: [
          {
            id: "materias_primas",
            label: "Matérias-primas utilizadas",
            type: "repeater",
            addItemLabel: "Adicionar matéria-prima",
            noPresetMemory: true,
            itemFields: [
              { id: "nome", label: "Nome", type: "text", enterToAdd: true },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
              { id: "unidade", label: "Unidade", type: "button-select", allowOther: true, options: ["kg", "t", "L", "m³", "un", "saco"] },
              { id: "periodicidade", label: "Periodicidade", type: "button-select", allowOther: true, options: ["Diária", "Semanal", "Mensal", "Anual"] },
            ],
          },
        ],
      },
      {
        id: "energia_combustiveis",
        title: "Energia e combustíveis",
        fields: [
          {
            id: "energia_combustiveis",
            label: "Consumos de energia e combustíveis",
            type: "repeater",
            addItemLabel: "Adicionar consumo",
            itemFields: [
              { id: "tipo", label: "Tipo", type: "button-select", allowOther: true, learn: true, options: ["Diesel", "Gasolina", "GLP", "Energia elétrica", "Lenha", "Gás natural", "Etanol", "Biomassa"] },
              { id: "consumo", label: "Consumo", type: "number" },
              { id: "unidade", label: "Unidade", type: "button-select", allowOther: true, options: ["L/mês", "kWh/mês", "kg/mês", "m³/mês"] },
              { id: "observacao", label: "Observação", type: "text", commentable: true },
            ],
          },
        ],
      },
      {
        id: "equipamentos",
        title: "Equipamentos",
        fields: [
          {
            id: "equipamentos",
            label: "Equipamentos existentes",
            type: "repeater",
            addItemLabel: "Adicionar equipamento",
            noPresetMemory: true,
            itemFields: [
              { id: "nome", label: "Nome", type: "text", enterToAdd: true },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
              { id: "especificacoes", label: "Especificações", type: "text", commentable: true },
            ],
          },
        ],
      },
      {
        id: "etapas",
        title: "Etapas do processo produtivo",
        fields: [
          {
            id: "etapas",
            label: "Etapas",
            type: "repeater",
            addItemLabel: "Adicionar etapa",
            noPresetMemory: true,
            itemFields: [
              { id: "nome", label: "Nome da etapa", type: "text", enterToAdd: true },
              { id: "descricao", label: "Descrição", type: "textarea", commentable: true },
            ],
          },
        ],
      },
      {
        id: "quimicos",
        title: "Produtos químicos",
        fields: [
          { id: "produtos_quimicos", label: "Produtos químicos utilizados", type: "button-select", multi: true, allowOther: true, options: ["Cloro", "Soda cáustica", "Ácido sulfúrico", "Ácido clorídrico", "Solventes", "Tintas", "Óleos", "Detergentes", "Hipoclorito"] },
        ],
      },
      {
        id: "frota",
        title: "Frota",
        fields: [
          { id: "tem_frota", label: "Possui frota de veículos?", type: "button-select", options: ["Sim", "Não"] },
          {
            id: "frota",
            label: "Veículos",
            type: "repeater",
            addItemLabel: "Adicionar veículo",
            showIf: { field: "tem_frota", equals: "Sim" },
            itemFields: [
              { id: "tipo", label: "Tipo", type: "button-select", allowOther: true, learn: true, options: ["Carro", "Moto", "Caminhão", "Caminhonete", "Van", "Empilhadeira", "Trator"] },
              { id: "quantidade", label: "Quantidade", type: "quantity" },
              { id: "observacao", label: "Placas, modelos, marcas", type: "text", commentable: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "residuos",
    title: "Resíduos Sólidos",
    description: "Tipos de resíduos gerados, gerenciamento e coleta.",
    fields: [],
    purposes: ["projeto", "acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "lista",
        title: "Resíduos gerados",
        description: "Adicione cada resíduo gerado pela operação. Selecione o tipo e preencha os detalhes.",
        fields: [
          {
            id: "residuos_lista",
            label: "Resíduos",
            type: "repeater",
            addItemLabel: "Adicionar resíduo",
            itemFields: [
              {
                id: "tipo",
                label: "Tipo de resíduo",
                type: "button-select",
                allowOther: true,
                learn: true,
                options: [
                  // Recicláveis
                  "Papel", "Papelão", "Plástico", "Vidro", "Metal", "Alumínio", "Tetra Pak",
                  // Orgânicos
                  "Orgânico", "Poda/Verde", "Resto de comida",
                  // Perigosos
                  "Químicos", "Óleos", "Pilhas/baterias", "Lâmpadas", "EPI contaminado",
                  "Solventes/Tintas", "Eletrônicos", "Resíduos de saúde",
                  // Inertes / construção
                  "Entulho", "Construção civil",
                  // Outros
                  "Rejeito",
                  // Por classificação (sem tipo específico)
                  "Resíduo perigoso (Classe I)",
                  "Resíduo não inerte (Classe II-A)",
                  "Resíduo inerte (Classe II-B)",
                  "Recicláveis (mistos)",
                  "Não recicláveis (mistos)",
                ],
                colorByValue: {
                  // CONAMA 275
                  "Papel": "#2563eb",
                  "Papelão": "#1d4ed8",
                  "Plástico": "#dc2626",
                  "Vidro": "#16a34a",
                  "Metal": "#eab308",
                  "Alumínio": "#a3a3a3",
                  "Tetra Pak": "#7c3aed",
                  "Orgânico": "#92400e",
                  "Poda/Verde": "#15803d",
                  "Resto de comida": "#a16207",
                  "Químicos": "#ea580c",
                  "Óleos": "#1f2937",
                  "Pilhas/baterias": "#7c2d12",
                  "Lâmpadas": "#facc15",
                  "EPI contaminado": "#be123c",
                  "Solventes/Tintas": "#9333ea",
                  "Eletrônicos": "#0ea5e9",
                  "Resíduos de saúde": "#e11d48",
                  "Entulho": "#64748b",
                  "Construção civil": "#475569",
                  "Rejeito": "#6b7280",
                  "Resíduo perigoso (Classe I)": "#ea580c",
                  "Resíduo não inerte (Classe II-A)": "#f59e0b",
                  "Resíduo inerte (Classe II-B)": "#64748b",
                  "Recicláveis (mistos)": "#16a34a",
                  "Não recicláveis (mistos)": "#6b7280",
                },
                iconByValue: {
                  "Papel": "🗞️",
                  "Papelão": "📦",
                  "Plástico": "🧴",
                  "Vidro": "🍶",
                  "Metal": "🥫",
                  "Alumínio": "🥤",
                  "Tetra Pak": "🧃",
                  "Orgânico": "🍎",
                  "Poda/Verde": "🌿",
                  "Resto de comida": "🍽️",
                  "Químicos": "⚗️",
                  "Óleos": "🛢️",
                  "Pilhas/baterias": "🔋",
                  "Lâmpadas": "💡",
                  "EPI contaminado": "🧤",
                  "Solventes/Tintas": "🎨",
                  "Eletrônicos": "💻",
                  "Resíduos de saúde": "🏥",
                  "Entulho": "🧱",
                  "Construção civil": "🏗️",
                  "Rejeito": "🗑️",
                  "Resíduo perigoso (Classe I)": "☣️",
                  "Resíduo não inerte (Classe II-A)": "♻️",
                  "Resíduo inerte (Classe II-B)": "🧱",
                  "Recicláveis (mistos)": "♻️",
                  "Não recicláveis (mistos)": "🚫",
                },
                classOnlyValues: [
                  "Resíduo perigoso (Classe I)",
                  "Resíduo não inerte (Classe II-A)",
                  "Resíduo inerte (Classe II-B)",
                  "Recicláveis (mistos)",
                  "Não recicláveis (mistos)",
                ],
              },
              {
                id: "categoria",
                label: "Classificação NBR 10004",
                type: "button-select",
                allowOther: true,
                hideWhenAutoLinked: true,
                options: ["Classe I (Perigoso)", "Classe II-A (Não inerte)", "Classe II-B (Inerte)"],
                autoLink: {
                  from: "tipo",
                  map: {
                    "Papel": "Classe II-A (Não inerte)",
                    "Papelão": "Classe II-A (Não inerte)",
                    "Plástico": "Classe II-A (Não inerte)",
                    "Vidro": "Classe II-B (Inerte)",
                    "Metal": "Classe II-A (Não inerte)",
                    "Alumínio": "Classe II-A (Não inerte)",
                    "Tetra Pak": "Classe II-A (Não inerte)",
                    "Orgânico": "Classe II-A (Não inerte)",
                    "Poda/Verde": "Classe II-A (Não inerte)",
                    "Resto de comida": "Classe II-A (Não inerte)",
                    "Rejeito": "Classe II-A (Não inerte)",
                    "Químicos": "Classe I (Perigoso)",
                    "Óleos": "Classe I (Perigoso)",
                    "Pilhas/baterias": "Classe I (Perigoso)",
                    "Lâmpadas": "Classe I (Perigoso)",
                    "EPI contaminado": "Classe I (Perigoso)",
                    "Solventes/Tintas": "Classe I (Perigoso)",
                    "Eletrônicos": "Classe I (Perigoso)",
                    "Resíduos de saúde": "Classe I (Perigoso)",
                    "Entulho": "Classe II-B (Inerte)",
                    "Construção civil": "Classe II-B (Inerte)",
                  },
                },
              },
              { id: "quantidade", label: "Quantidade", type: "number", unit: "kg" },
              { id: "periodicidade", label: "Periodicidade", type: "button-select", allowOther: true, learn: true, applyToOthers: true, collapseWhenFilled: true, options: ["Diária", "Semanal", "Quinzenal", "Mensal", "Eventual"] },
              { id: "acondicionamento", label: "Acondicionamento", type: "button-select", allowOther: true, learn: true, applyToOthers: true, collapseWhenFilled: true, options: ["Bombona", "Big bag", "Tambor", "Saco plástico", "Container", "Caixa de papelão", "Pallet", "A granel"] },
              { id: "destino", label: "Destinação", type: "button-select", allowOther: true, learn: true, applyToOthers: true, collapseWhenFilled: true, options: ["Aterro sanitário", "Aterro industrial", "Reciclagem", "Reuso interno", "Compostagem", "Coprocessamento", "Incineração", "Logística reversa"] },
              { id: "coletor", label: "Quem coleta", type: "button-select", allowOther: true, learn: true, applyToOthers: true, collapseWhenFilled: true, options: ["Coleta pública", "Empresa terceirizada", "Catador", "Logística reversa do fornecedor"] },
            ],
          },
        ],
      },
      {
        id: "coleta",
        title: "Coleta de resíduos",
        fields: [
          { id: "coleta_tipo", label: "Como se aplica a coleta", type: "multiselect", options: ["Coleta pública", "Empresa terceirizada", "Outro"] },
          { id: "empresa_coleta", label: "Empresa terceirizada (nome / CNPJ)", type: "text" },
          { id: "outro_coleta", label: "Outro tipo de coleta (especificar)", type: "text" },
          { id: "periodicidade", label: "Periodicidade geral da coleta", type: "text" },
        ],
      },
      {
        id: "gerenciamento",
        title: "Gerenciamento de resíduos sólidos",
        fields: [
          { id: "gerenciamento", label: "Está ocorrendo de forma correta?", type: "select", options: ["Sim", "Não", "Falta estruturar", "Precisa de local adequado", "Não há lixeiras suficientes", "Não se aplica"] },
          { id: "lixeiras", label: "As lixeiras estão sendo utilizadas adequadamente?", type: "select", options: ["Sim", "Não", "Parcialmente", "Faltam lixeiras", "Não foi avaliado"] },
          { id: "dificuldade_coleta", label: "Alguma dificuldade na coleta?", type: "select", options: ["Sim", "Não"] },
          { id: "dificuldade_coleta_desc", label: "Descrição da dificuldade", type: "textarea" },
          { id: "gerenciamento_obs", label: "Observações", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "politica",
    title: "Política e Gestão Ambiental",
    description: "Atendimento à política ambiental, educação ambiental e demandas de projeto.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "respeito",
        title: "Respeito à política ambiental",
        fields: [
          { id: "politica_status", label: "A política está sendo respeitada?", type: "button-select", options: ["Sim", "Não", "Parcialmente", "Em implantação", "Falta mais avisos", "Não há política", "Não foi avaliado"] },
        ],
      },
      {
        id: "coleta_recicl",
        title: "Coleta de resíduos recicláveis e não recicláveis",
        fields: [
          { id: "coleta_recicl_status", label: "Está sendo realizada?", type: "button-select", options: ["Sim", "Não", "Parcialmente", "Em fase de contratação", "Não há", "Não se aplica a essa visita"] },
        ],
      },
      {
        id: "educacao",
        title: "Educação ambiental",
        fields: [
          { id: "educacao_status", label: "Há necessidade de novas palestras?", type: "button-select", options: ["Sim", "Não", "Houve agendamento", "Não se aplica", "Não há perspectiva no momento", "Irá contactar o escritório havendo necessidade"] },
          { id: "palestras", label: "Palestras / orientações realizadas", type: "textarea", showIf: { field: "educacao_status", in: ["Sim", "Houve agendamento"] } },
        ],
      },
      {
        id: "demandas",
        title: "Levantamento de informações para projeto",
        fields: [
          { id: "ha_demanda_projeto", label: "Há levantamento para projeto?", type: "button-select", options: ["Sim", "Não"] },
          { id: "tipo_demanda", label: "Tipo(s) de demanda / documento", type: "button-select", multi: true, options: ["OUTORGA", "PEA", "CAR", "PCA", "RCA", "PGRS", "RIAA"], showIf: { field: "ha_demanda_projeto", equals: "Sim" } },
        ],
      },
    ],
  },
  {
    id: "rotinas",
    title: "Rotinas de Monitoramento",
    description: "Hidrômetro, coletas de água, coletas de efluente e acompanhamento operacional.",
    fields: [],
    purposes: ["monitoramento", "acompanhamento"],
    subgroups: [
      {
        id: "hidrometro",
        title: "Leitura do hidrômetro",
        fields: [
          { id: "hidrometro_status", label: "Há leitura diária do hidrômetro?", type: "button-select", options: ["Sim", "Não", "Não há tabela", "Não se aplica", "O colaborador não está fazendo o acompanhamento"] },
          { id: "hidrometro", label: "Leitura registrada nesta visita", type: "number" },
        ],
      },
      {
        id: "coleta_agua",
        title: "Coleta de água do poço",
        fields: [
          { id: "coleta_agua_visita", label: "Houve coleta nesta visita?", type: "button-select", options: ["Sim", "Não"] },
          { id: "coletas_agua", label: "Detalhes da coleta", type: "textarea", showIf: { field: "coleta_agua_visita", equals: "Sim" } },
        ],
      },
      {
        id: "coleta_efluente",
        title: "Coleta de efluente na ETE",
        fields: [
          { id: "coleta_efluente_visita", label: "Houve coleta nesta visita?", type: "button-select", options: ["Sim", "Não"] },
          { id: "coletas_efluente", label: "Detalhes da coleta", type: "textarea", showIf: { field: "coleta_efluente_visita", equals: "Sim" } },
        ],
      },
      {
        id: "acompanhamento",
        title: "Acompanhamento operacional (opcional)",
        optional: true,
        fields: [
          { id: "acompanhamento_obs", label: "Anotações livres", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "vizinhanca",
    title: "Vizinhança e Entorno",
    description: "Terrenos vizinhos por posição, mercado local e obras próximas.",
    fields: [],
    purposes: ["projeto"],
    subgroups: [
      {
        id: "vizinhos",
        title: "Vizinhos confrontantes",
        fields: [
          {
            id: "vizinhos",
            label: "Vizinhos por posição",
            type: "repeater",
            addItemLabel: "Adicionar vizinho",
            itemFields: [
              { id: "posicao", label: "Posição", type: "button-select", options: ["Fundos", "Lateral direita", "Lateral esquerda", "Frente"] },
              { id: "material", label: "Material", type: "button-select", allowOther: true, options: ["Madeira", "Alvenaria", "Misto"] },
              { id: "estado", label: "Estado", type: "button-select", options: ["Bom", "Ruim"] },
              { id: "pavimentos", label: "Nº de pavimentos", type: "number", decimal: false },
              { id: "habitado", label: "Habitado?", type: "button-select", options: ["Sim", "Não"] },
              { id: "utilizacao", label: "Utilização", type: "button-select", options: ["Industrial", "Comercial", "Habitacional", "Misto"] },
              { id: "classe", label: "Classe social", type: "button-select", options: ["Alta", "Média", "Baixa"] },
              { id: "afastamento", label: "Posição relativa", type: "button-select", options: ["Afastada", "Próxima", "Encostada"] },
              { id: "reforco", label: "Necessita reforço?", type: "button-select", options: ["Sim", "Não"] },
            ],
          },
        ],
      },
      {
        id: "laudo",
        title: "Laudo técnico",
        fields: [
          { id: "necessita_laudo", label: "Há necessidade de laudo técnico?", type: "button-select", options: ["Sim", "Não", "Não se aplica"] },
        ],
      },
      {
        id: "mercado",
        title: "Mercado local",
        fields: [
          { id: "mercado_local", label: "Itens disponíveis na região", type: "button-select", multi: true, allowOther: true, learn: true, options: ["Hospital", "Posto de saúde", "Escola", "Creche", "Universidade", "Shopping", "Farmácia", "Concretaria", "Supermercado", "Pedreira", "Casas para república", "Mão de obra administrativa", "Mão de obra operária", "Posto de combustível", "Praça", "Parque", "Áreas verdes", "Ciclovia", "Cinema", "Biblioteca", "Estádio", "Quadra esportiva", "Centro comunitário", "Banco / lotérica", "Igreja", "Restaurante", "Hotel / Pousada", "Indústria próxima", "Centro comercial", "Ponto de ônibus / terminal", "Delegacia", "Corpo de bombeiros"] },
        ],
      },
      {
        id: "obras",
        title: "Obras próximas",
        optional: true,
        fields: [
          { id: "tipo_obra", label: "Tipo de obra próxima", type: "text" },
        ],
      },
    ],
  },
  {
    id: "infraestrutura",
    title: "Acesso e Infraestrutura Pública",
    description: "Acesso por posição do terreno e infraestrutura pública disponível.",
    fields: [],
    purposes: ["projeto"],
    subgroups: [
      {
        id: "acessos",
        title: "Acessos",
        fields: [
          {
            id: "pavimentacao_lados",
            label: "Tipo de pavimentação por lado",
            type: "apply-to-sides",
            sides: ["Frente", "Fundos", "Lado direito", "Lado esquerdo"],
            options: ["Asfalto", "Paralelepípedo", "Terra", "Concreto", "Bloquete", "Inexistente", "Outro"],
          },
          {
            id: "ruas",
            label: "Nome das ruas (por lado)",
            type: "repeater",
            addItemLabel: "Adicionar lado",
            itemFields: [
              { id: "lado", label: "Lado", type: "button-select", options: ["Frente", "Fundos", "Lado direito", "Lado esquerdo"] },
              { id: "rua", label: "Nome da rua", type: "text" },
            ],
          },
        ],
      },
      {
        id: "publica",
        title: "Infraestrutura pública",
        fields: [
          { id: "infra_servicos", label: "Serviços e equipamentos públicos disponíveis", type: "button-select", multi: true, allowOther: true, learn: true, options: ["Abastecimento de água", "Energia elétrica", "Coleta de lixo", "Iluminação pública", "Iluminação LED", "Rede de esgoto", "Telefone", "Internet / Fibra", "Rede de drenagem pluvial", "Alta tensão", "Asfalto / Pavimentação", "Coleta seletiva", "Posto de saúde", "Hospital", "Escola", "Creche", "Praça", "Parque", "Áreas de lazer", "Quadra esportiva", "Centro comunitário", "Igreja", "Gás encanado", "Transporte público", "Ponto de ônibus"] },
        ],
      },
    ],
  },
  {
    id: "obra_amb_identificacao",
    title: "Identificação da Visita",
    description: "Contexto básico do acompanhamento ambiental da obra.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "dados_visita",
        title: "Dados da visita",
        fields: [
          { id: "cliente", label: "Cliente", type: "text" },
          { id: "obra_empreendimento", label: "Obra / empreendimento", type: "text" },
          { id: "local_obra", label: "Local da obra", type: "text" },
          { id: "data_visita", label: "Data da visita", type: "date" },
          { id: "hora_chegada", label: "Horário de chegada", type: "time" },
          { id: "hora_saida", label: "Horário de saída", type: "time" },
          { id: "responsavel_acompanhamento", label: "Responsável pelo acompanhamento", type: "text" },
          { id: "pessoa_vistoria", label: "Pessoa que realizou a vistoria", type: "text" },
          { id: "pessoa_local", label: "Pessoa que acompanhou no local", type: "text" },
          { id: "cargo_pessoa_local", label: "Cargo/função da pessoa que acompanhou", type: "text" },
          { id: "condicao_climatica", label: "Condição climática no momento da visita", type: "button-select", options: CONDICOES_CLIMATICAS_OBRA },
        ],
      },
      {
        id: "tipo_acompanhamento",
        title: "Tipo de acompanhamento",
        fields: [
          { id: "tipo_visita", label: "Tipo de visita", type: "button-select", options: TIPOS_VISITA_OBRA, allowOther: true },
          { id: "objetivo_visita", label: "Objetivo da visita", type: "textarea" },
          { id: "visita_recorrente", label: "Visita recorrente?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
          { id: "semana_referencia", label: "Semana/referência do acompanhamento", type: "text" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_situacao",
    title: "Situação Geral da Obra",
    description: "Status geral, fase e avanço percebido desde a visita anterior.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "status_obra",
        title: "Status da obra",
        fields: [
          { id: "status_geral_obra", label: "Status geral da obra", type: "button-select", options: STATUS_OBRA, allowOther: true },
          { id: "fase_atual_obra", label: "Fase atual da obra", type: "button-select", options: FASES_OBRA, allowOther: true },
          { id: "houve_avanco", label: "Houve avanço desde a última visita?", type: "button-select", options: ["Sim", "Não", "Parcialmente", "Não aplicável", "Não avaliado"] },
          { id: "obra_dentro_previsto", label: "A obra está dentro do previsto?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "percentual_avanco", label: "Percentual aproximado de avanço", type: "number", unit: "%" },
          { id: "resumo_semana", label: "Resumo rápido da semana", type: "textarea" },
          { id: "mudancas_visita_anterior", label: "O que mudou desde a última visita?", type: "textarea" },
          { id: "pendencias_anteriores_resolvidas", label: "Pendências anteriores resolvidas?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
        ],
      },
    ],
  },
  {
    id: "obra_amb_controle",
    title: "Controle Ambiental da Obra",
    description: "Verificação objetiva dos principais controles ambientais no canteiro.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento", "projeto"],
    subgroups: [
      {
        id: "condicoes_ambientais",
        title: "Condições ambientais gerais",
        fields: [
          { id: "controle_ambiental_visivel", label: "Há controle ambiental visível na obra?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "area_delimitada", label: "A área da obra está delimitada?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "interferencia_vegetacao", label: "Há interferência em vegetação?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "supressao_poda_recente", label: "Há supressão ou poda recente?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "sinais_erosao", label: "Há sinais de erosão?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "carreamento_sedimentos", label: "Há carreamento de solo/sedimentos?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "material_inadequado", label: "Há acúmulo de material em local inadequado?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "intervencao_area_sensivel", label: "Há intervenção em APP, curso d’água, drenagem ou área sensível?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "contaminacao_solo", label: "Há evidência de contaminação do solo?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "poeira_significativa", label: "Há emissão de poeira significativa?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "ruido_relevante", label: "Há geração de ruído relevante?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "odor_emissao", label: "Há odor ou emissão perceptível?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
        ],
      },
      {
        id: "observacao_ambiental",
        title: "Observação ambiental",
        optional: true,
        fields: [
          { id: "observacao_ambiental", label: "Observação ambiental da visita", type: "textarea" },
          { id: "pontos_ambientais_atencao", label: "Pontos ambientais de atenção", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_boas_praticas",
    title: "Organização, Segurança e Boas Práticas",
    description: "Organização do canteiro, sinalização, segurança aparente e orientações em campo.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "organizacao_obra",
        title: "Organização da obra",
        fields: [
          { id: "obra_organizada", label: "A obra está organizada?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "materiais_armazenados", label: "Os materiais estão armazenados adequadamente?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "acessos_livres", label: "Os acessos estão livres?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "sinalizacao_basica", label: "Há sinalização básica?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "area_materiais", label: "Há área definida para armazenamento de materiais?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "area_residuos", label: "Há área definida para resíduos?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "limpeza_geral", label: "Há limpeza geral adequada?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "risco_aparente", label: "Há risco aparente no local?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
        ],
      },
      {
        id: "seguranca_conduta",
        title: "Segurança e conduta",
        fields: [
          { id: "equipe_epi", label: "A equipe estava utilizando EPI?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "equipe_trabalhando", label: "Havia equipe trabalhando no momento da visita?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "responsavel_presente", label: "Havia responsável da obra presente?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "condicao_insegura", label: "Há condição insegura aparente?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "orientacao_repassada", label: "Alguma orientação foi repassada em campo?", type: "button-select", options: SIM_NAO_PARCIAL_AVALIADO },
          { id: "obs_boas_praticas", label: "Observações sobre segurança, organização e boas práticas", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_residuos",
    title: "Resíduos da Obra",
    description: "Geração, segregação, acondicionamento e destinação básica de resíduos.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "gestao_residuos",
        title: "Gestão de resíduos",
        fields: [
          { id: "residuos_gerados", label: "Há resíduos gerados na obra?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "residuos_segregados", label: "Os resíduos estão segregados?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "residuos_acondicionados", label: "Os resíduos estão acondicionados adequadamente?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "recipiente_residuos", label: "Há recipiente, caçamba ou local definido para resíduos?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "mistura_residuos", label: "Há mistura de resíduos?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "residuos_espalhados", label: "Há resíduos espalhados no canteiro?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "residuos_perigosos", label: "Há resíduos perigosos ou contaminados?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "retirada_coleta", label: "Houve retirada/coleta desde a última visita?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "comprovante_destinacao", label: "Há comprovante ou registro de destinação?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
        ],
      },
      {
        id: "tipos_residuos",
        title: "Tipos de resíduos observados",
        fields: [
          { id: "tipos_residuos_observados", label: "Tipos de resíduos observados", type: "button-select", multi: true, options: TIPOS_RESIDUOS_OBRA, allowOther: true },
          { id: "destinacao_observada", label: "Destinação observada", type: "text" },
          { id: "responsavel_coleta", label: "Responsável pela coleta/destinação", type: "text" },
          { id: "obs_residuos", label: "Observações sobre resíduos", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_agua_drenagem",
    title: "Efluentes, Água e Drenagem",
    description: "Água, drenagem, efluentes e possíveis impactos associados.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "agua_drenagem",
        title: "Água e drenagem",
        fields: [
          { id: "acumulo_agua", label: "Há acúmulo de água na obra?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "drenagem_provisoria", label: "Há drenagem provisória?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "erosao_escoamento", label: "Há sinais de erosão por escoamento?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "lancamento_irregular", label: "Há lançamento irregular de água ou efluente?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "lama_via_publica", label: "Há lama ou carreamento para via pública?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "protecao_drenagem", label: "Há proteção de bocas de lobo ou drenagem?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "uso_agua_obra", label: "Há uso de água na obra?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "origem_agua_identificada", label: "A água utilizada possui origem identificada?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
        ],
      },
      {
        id: "efluentes_sanitarios",
        title: "Efluentes e sanitários",
        fields: [
          { id: "banheiro_quimico", label: "Há banheiro químico ou estrutura sanitária?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "destinacao_efluentes", label: "Há destinação adequada de efluentes sanitários?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "vazamento_aparente", label: "Há vazamento aparente?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "odor_extravasamento", label: "Há odor ou extravasamento?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "registro_coleta_manutencao", label: "Há registro de coleta/manutenção?", type: "button-select", options: SIM_NAO_PARCIAL_NA },
          { id: "obs_agua_drenagem", label: "Observações sobre água, efluentes e drenagem", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_nao_conformidades",
    title: "Não Conformidades e Pendências",
    description: "Registro do que está errado, o que precisa ser corrigido e quem deve agir.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "nao_conformidades",
        title: "Não conformidades",
        fields: [
          { id: "foram_identificadas_nc", label: "Foram identificadas não conformidades?", type: "button-select", options: SIM_NAO_NA },
          {
            id: "nao_conformidades_itens",
            label: "Não conformidades registradas",
            type: "repeater",
            addItemLabel: "Adicionar não conformidade",
            itemFields: [
              { id: "tipo", label: "Tipo de não conformidade", type: "button-select", options: TIPOS_NAO_CONFORMIDADE_OBRA, allowOther: true },
              { id: "descricao", label: "Descrição da não conformidade", type: "textarea" },
              { id: "gravidade", label: "Gravidade", type: "button-select", options: GRAVIDADES_OBRA },
              { id: "acao_imediata", label: "Requer ação imediata?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
              { id: "foto_vinculada", label: "Foto vinculada?", type: "button-select", options: ["Sim", "Não"] },
              { id: "responsavel", label: "Responsável pela correção", type: "text" },
              { id: "prazo", label: "Prazo para correção", type: "date" },
              { id: "status", label: "Status da não conformidade", type: "button-select", options: STATUS_PENDENCIA_OBRA },
            ],
          },
        ],
      },
      {
        id: "pendencias",
        title: "Pendências",
        fields: [
          { id: "ha_pendencias", label: "Há pendências da visita?", type: "button-select", options: SIM_NAO_NA },
          {
            id: "pendencias_itens",
            label: "Pendências da visita",
            type: "repeater",
            addItemLabel: "Adicionar pendência",
            itemFields: [
              { id: "descricao", label: "Descrição da pendência", type: "textarea" },
              { id: "responsavel", label: "Responsável", type: "text" },
              { id: "prazo", label: "Prazo", type: "date" },
              { id: "prioridade", label: "Prioridade", type: "button-select", options: PRIORIDADES_OBRA },
              { id: "status", label: "Status da pendência", type: "button-select", options: STATUS_PENDENCIA_OBRA },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "obra_amb_encaminhamentos",
    title: "Encaminhamentos e Próxima Visita",
    description: "Ações após a visita, comunicações e pontos para retorno.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "encaminhamentos",
        title: "Encaminhamentos",
        fields: [
          { id: "encaminhamentos_definidos", label: "Encaminhamentos definidos", type: "textarea" },
          { id: "quem_comunicar", label: "Quem deve ser comunicado?", type: "text" },
          { id: "retorno_antes_proxima", label: "Há necessidade de retorno antes da próxima visita?", type: "button-select", options: SIM_NAO_NA },
          { id: "enviar_relatorio_cliente", label: "Deve ser enviado relatório ao cliente?", type: "button-select", options: SIM_NAO_NA },
          { id: "cobrar_correcao", label: "Deve ser cobrada correção?", type: "button-select", options: SIM_NAO_NA },
          { id: "solicitar_documento", label: "Deve ser solicitado documento?", type: "button-select", options: SIM_NAO_NA },
          { id: "nova_vistoria_especifica", label: "Deve ser realizada nova vistoria específica?", type: "button-select", options: SIM_NAO_NA },
        ],
      },
      {
        id: "proxima_visita",
        title: "Próxima visita",
        fields: [
          { id: "proxima_visita_prevista", label: "Próxima visita prevista", type: "date" },
          { id: "pontos_verificar_proxima", label: "Pontos a verificar na próxima visita", type: "textarea" },
          { id: "pendencias_revisar_proxima", label: "Pendências que devem ser revisadas na próxima visita", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "obra_amb_encerramento",
    title: "Encerramento",
    description: "Fechamento da visita e liberação do relatório semanal.",
    fields: [],
    purposes: ["acompanhamento", "monitoramento"],
    subgroups: [
      {
        id: "fechamento",
        title: "Fechamento",
        fields: [
          { id: "situacao_final", label: "Situação final da visita", type: "button-select", options: SITUACOES_FINAIS_OBRA, allowOther: true },
          { id: "pode_concluir", label: "Levantamento pode ser concluído?", type: "button-select", options: ["Sim", "Não", "Parcialmente"] },
          { id: "concluida_com_pendencias", label: "Visita concluída com pendências?", type: "button-select", options: ["Sim", "Não"] },
          { id: "concluida_sem_pendencias", label: "Visita concluída sem pendências?", type: "button-select", options: ["Sim", "Não"] },
          { id: "necessario_retorno", label: "Necessário retorno?", type: "button-select", options: ["Sim", "Não"] },
          { id: "data_encerramento", label: "Data de encerramento", type: "date" },
          { id: "responsavel_encerramento", label: "Responsável pelo encerramento", type: "text" },
          { id: "observacao_encerramento", label: "Observação de encerramento", type: "textarea" },
          { id: "assinatura_responsavel", label: "Assinatura do responsável, se necessário", type: "signature" },
        ],
      },
    ],
  },
  {
    id: "fotos",
    title: "Relatório Fotográfico",
    description: "Marque Sim ou Não para cada tipo de foto. Os anexos são feitos na etapa de conclusão.",
    fields: [
      { id: "descricao_fotos", label: "Observações gerais sobre as fotos", type: "textarea" },
      { id: "legenda_foto", label: "Legenda das fotos", type: "textarea" },
      { id: "foto_vinculo", label: "Foto vinculada a qual item?", type: "button-select", options: VINCULOS_FOTO_OBRA, allowOther: true },
      { id: "foto_comprova_avanco", label: "Foto comprova avanço?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
      { id: "foto_comprova_pendencia", label: "Foto comprova pendência?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
      { id: "foto_comprova_nao_conformidade", label: "Foto comprova não conformidade?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
      { id: "foto_comprova_correcao", label: "Foto comprova correção?", type: "button-select", options: ["Sim", "Não", "Não avaliado"] },
    ],
  },
  {
    id: "documentos",
    title: "Documentos e Anexos",
    description: "Documentos entregues, solicitados e checklist de documentação.",
    fields: [],
    subgroups: [
      {
        id: "entrega",
        title: "Documento entregue na visita",
        fields: [
          { id: "doc_entregue_visita", label: "Foi entregue algum documento nesta visita?", type: "select", options: ["Sim", "Não"] },
          { id: "entregues", label: "Documentos entregues (descrição)", type: "textarea", showIf: { field: "doc_entregue_visita", equals: "Sim" } },
        ],
      },
      {
        id: "solicitacao",
        title: "Documentos solicitados",
        fields: [
          { id: "solicitados", label: "Documentos solicitados ao cliente", type: "textarea" },
          { id: "solicitar_doc_empresa", label: "Solicitar cópias da documentação da empresa?", type: "boolean" },
        ],
      },
      {
        id: "orientacao",
        title: "Orientação técnica",
        fields: [
          { id: "orientacao_status", label: "Houve orientação do técnico sobre as pendências ambientais?", type: "select", options: ["Sim", "Não", "No aguardo do posicionamento da empresa", "Ficamos de enviar um relatório", "O colaborador ficou de enviar à diretoria"] },
          { id: "orientacao_obs", label: "Observações", type: "textarea" },
        ],
      },
    ],
  },
  {
    id: "validacao",
    title: "Validação e Encerramento",
    fields: [
      { id: "hora_saida", label: "Horário de saída", type: "time" },
      { id: "assinatura_cliente", label: "Nome de quem assinou pelo cliente", type: "text" },
    ],
  },
];

export const MODULES_BY_TYPE: Record<SurveyType, string[]> = {
  geral: [
    "identificacao", "empreendimento", "pessoas", "localizacao", "operacionais",
    "areas", "agua", "pocos", "processo", "emissoes", "residuos", "ete",
    "politica", "rotinas", "infraestrutura", "vizinhanca", "fotos",
    "documentos", "validacao",
  ],
  ambiental: [
    "identificacao", "empreendimento", "pessoas", "politica", "residuos",
    "ete", "rotinas", "operacionais", "documentos", "fotos", "validacao",
  ],
  vazao: [
    "identificacao", "empreendimento", "pessoas", "localizacao", "vazao",
    "fotos", "validacao",
  ],
  outorga: [
    "identificacao", "empreendimento", "pessoas", "localizacao", "agua",
    "pocos", "outorga", "operacionais", "documentos", "fotos", "validacao",
  ],
  terreno: [
    "identificacao", "empreendimento", "localizacao", "areas", "infraestrutura",
    "vizinhanca", "fotos", "validacao",
  ],
};

const MODULES_INDEX = new Map(MODULES.map((module) => [module.id, module]));

// Espelha os templates do Relatório Fotográfico como subgrupos somente-leitura
// para que apareçam em "Configurações → Estrutura dos formulários".
// O painel de levantamento renderiza o componente PhotoChecklist e ignora
// estes subgrupos (ver levantamentos.$id.index.tsx).
(() => {
  const fotos = MODULES_INDEX.get("fotos");
  if (!fotos) return;
  fotos.subgroups = ALL_TEMPLATE_KEYS.map((key) => {
    const tpl = PHOTO_CHECKLISTS[key];
    return {
      id: `tpl_${key}`,
      title: tpl.title,
      description: "Template de checklist fotográfico (Sim/Não por item).",
      fields: tpl.items.map((it) => ({
        id: it.id,
        label: it.label,
        type: "boolean" as const,
      })),
    };
  });
})();

const MODULES_BY_TYPE_CACHE: Record<SurveyType, typeof MODULES> = {
  geral: MODULES_BY_TYPE.geral.map((id) => MODULES_INDEX.get(id)!).filter(Boolean),
  ambiental: MODULES_BY_TYPE.ambiental.map((id) => MODULES_INDEX.get(id)!).filter(Boolean),
  vazao: MODULES_BY_TYPE.vazao.map((id) => MODULES_INDEX.get(id)!).filter(Boolean),
  outorga: MODULES_BY_TYPE.outorga.map((id) => MODULES_INDEX.get(id)!).filter(Boolean),
  terreno: MODULES_BY_TYPE.terreno.map((id) => MODULES_INDEX.get(id)!).filter(Boolean),
};

let _globalOverrides: FormStructureOverrides | undefined;
let _globalOverridesRef: FormStructureOverrides | undefined;
const _overriddenCache: Partial<Record<SurveyType, ModuleDef[]>> = {};

/** Setado pelo store para que getModulesForType reflita overrides automaticamente. */
export function setGlobalFormOverrides(overrides: FormStructureOverrides | undefined) {
  if (overrides === _globalOverridesRef) return;
  _globalOverridesRef = overrides;
  _globalOverrides = overrides;
  for (const k of Object.keys(_overriddenCache)) delete _overriddenCache[k as SurveyType];
}

export function getModulesForType(type: SurveyType): ModuleDef[] {
  const base = MODULES_BY_TYPE_CACHE[type] ?? [];
  if (!_globalOverrides || !hasAnyOverride(_globalOverrides)) return base;
  if (_overriddenCache[type]) return _overriddenCache[type]!;
  const computed = applyFormOverrides(base, _globalOverrides);
  _overriddenCache[type] = computed;
  return computed;
}

function hasAnyOverride(o: FormStructureOverrides): boolean {
  return !!(
    (o.modules && Object.keys(o.modules).length) ||
    (o.subgroups && Object.keys(o.subgroups).length) ||
    (o.fields && Object.keys(o.fields).length) ||
    (o.customSubgroups && Object.keys(o.customSubgroups).length) ||
    (o.customFields && Object.keys(o.customFields).length)
  );
}

/** Avaliador de regra `showIf` para campos condicionais. */
export function shouldShowField(field: FieldDef, values: Record<string, unknown>): boolean {
  const rule = field.showIf;
  if (!rule) return true;
  const v = values[rule.field];
  if (rule.equals !== undefined) return v === rule.equals;
  if (rule.in && rule.in.length) {
    if (Array.isArray(v)) return v.some((x) => rule.in!.includes(x));
    return rule.in.includes(v as unknown);
  }
  if (rule.truthy) {
    if (Array.isArray(v)) return v.length > 0;
    return Boolean(v);
  }
  return true;
}

function fieldHasValue(v: unknown): boolean {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    // hours-presets: tem preset ou turnos preenchidos
    const o = v as Record<string, unknown>;
    if (typeof o.preset === "string" && o.preset) return true;
    if (Array.isArray(o.turnos) && (o.turnos as unknown[]).length > 0) return true;
    return Object.values(v as Record<string, unknown>).some((x) => x !== "" && x != null);
  }
  return true;
}

const PENDING_STATUSES = new Set<FieldStatus>([
  "pendente",
  "aguardando_documento",
  "aguardando_empresa",
  "requer_retorno",
]);

/** Lista os campos visíveis de um módulo considerando showIf e subgrupos N/A. */
export function visibleFieldsOfModule(
  m: ModuleDef,
  values: Record<string, unknown>,
  naSubgroups?: Record<string, boolean>,
): FieldDef[] {
  const out: FieldDef[] = [];
  for (const f of m.fields) if (shouldShowField(f, values)) out.push(f);
  for (const sg of m.subgroups ?? []) {
    if (naSubgroups?.[sg.id]) continue;
    if (sg.optional) continue;
    for (const f of sg.fields) if (shouldShowField(f, values)) out.push(f);
  }
  return out;
}

/** Status efetivo do módulo (ignora `state.status` armazenado, exceto para módulos centrais sem campos). */
export function computeModuleStatus(m: ModuleDef, state: ModuleState): FieldStatus {
  if (state.naModule) return "nao_se_aplica";
  if (state.moduleDone) return "concluido";

  // Conta por campo, mas trata subgrupos concluídos manualmente como totalmente preenchidos.
  const moduleFields = m.fields.filter((f) => shouldShowField(f, state.values));
  let totalFields = 0;
  let filledFields = 0;
  let hasPending = false;

  for (const f of moduleFields) {
    totalFields++;
    const fs = state.fieldStatus[f.id];
    if (fs && PENDING_STATUSES.has(fs)) hasPending = true;
    if (state.nonApplicable?.[f.id]) { filledFields++; continue; }
    if (fieldHasValue(state.values[f.id])) filledFields++;
  }

  for (const sg of m.subgroups ?? []) {
    if (state.naSubgroups?.[sg.id]) continue;
    if (sg.optional) continue;
    const visible = sg.fields.filter((f) => shouldShowField(f, state.values));
    if (state.subgroupDone?.[sg.id]) {
      totalFields += visible.length;
      filledFields += visible.length;
      continue;
    }
    for (const f of visible) {
      totalFields++;
      const fs = state.fieldStatus[f.id];
      if (fs && PENDING_STATUSES.has(fs)) hasPending = true;
      if (state.nonApplicable?.[f.id]) { filledFields++; continue; }
      if (fieldHasValue(state.values[f.id])) filledFields++;
    }
  }

  if (hasPending) return "pendente";
  if (totalFields === 0) return state.status ?? "nao_iniciado";
  if (filledFields === totalFields) return "concluido";
  if (filledFields > 0) return "em_andamento";
  return "nao_iniciado";
}

/** Status efetivo de um subgrupo. */
export function computeSubgroupStatus(sg: SubgroupDef, state: ModuleState): FieldStatus {
  if (state.naSubgroups?.[sg.id]) return "nao_se_aplica";
  if (state.subgroupDone?.[sg.id]) return "concluido";
  const visible = sg.fields.filter((f) => shouldShowField(f, state.values));
  if (!visible.length) return sg.optional ? "concluido" : "nao_iniciado";

  for (const f of visible) {
    const fs = state.fieldStatus[f.id];
    if (fs && PENDING_STATUSES.has(fs)) return "pendente";
  }

  let filled = 0;
  for (const f of visible) {
    if (state.nonApplicable?.[f.id]) { filled++; continue; }
    if (fieldHasValue(state.values[f.id])) filled++;
  }

  if (filled === visible.length) return "concluido";
  if (filled > 0) return "em_andamento";
  return sg.optional ? "concluido" : "nao_iniciado";
}

/** Conta de campos preenchidos / total visível em um subgrupo. */
export function subgroupProgress(sg: SubgroupDef, state: ModuleState): { filled: number; total: number; na: number } {
  if (state.naSubgroups?.[sg.id]) return { filled: 0, total: 0, na: 0 };
  const visible = sg.fields.filter((f) => shouldShowField(f, state.values));
  let filled = 0; let na = 0;
  for (const f of visible) {
    if (state.nonApplicable?.[f.id]) { na++; filled++; continue; }
    if (fieldHasValue(state.values[f.id])) filled++;
  }
  return { filled, total: visible.length, na };
}

/** Módulos que ganham aba dedicada centralizada (não aparecem como aba comum). */
export const CENTRAL_TAB_MODULES = new Set(["documentos", "validacao"]);

/** Sugestões de presets de módulos por tipo de levantamento. */
export const MODULE_PRESETS: Record<SurveyType, { all: string[]; minimal: string[] }> = {
  geral: {
    all: MODULES_BY_TYPE.geral,
    minimal: ["identificacao", "empreendimento", "localizacao", "fotos", "documentos", "validacao"],
  },
  ambiental: {
    all: MODULES_BY_TYPE.ambiental,
    minimal: ["identificacao", "ete", "residuos", "rotinas", "fotos", "documentos", "validacao"],
  },
  vazao: { all: MODULES_BY_TYPE.vazao, minimal: MODULES_BY_TYPE.vazao },
  outorga: {
    all: MODULES_BY_TYPE.outorga,
    minimal: ["identificacao", "agua", "pocos", "outorga", "documentos", "validacao"],
  },
  terreno: {
    all: MODULES_BY_TYPE.terreno,
    minimal: ["identificacao", "localizacao", "areas", "fotos", "validacao"],
  },
};

/** Templates de fábrica embutidos por tipo (não removíveis). */
export interface FactoryTemplate { id: string; name: string; type: SurveyType; moduleIds: string[] }

export const FACTORY_TEMPLATES: FactoryTemplate[] = [
  { id: "factory-geral-completo", name: "Completo (todos os módulos)", type: "geral", moduleIds: MODULES_BY_TYPE.geral },
  { id: "factory-geral-essencial", name: "Essencial", type: "geral", moduleIds: ["identificacao","empreendimento","pessoas","operacionais","fotos","documentos","validacao"] },
  { id: "factory-geral-projeto", name: "Foco em Projeto", type: "geral", moduleIds: ["identificacao","empreendimento","pessoas","localizacao","operacionais","areas","agua","processo","emissoes","residuos","fotos","documentos","validacao"] },
  { id: "factory-ambiental-padrao", name: "Acompanhamento padrão", type: "ambiental", moduleIds: MODULES_BY_TYPE.ambiental },
  { id: "factory-ambiental-curto", name: "Visita curta", type: "ambiental", moduleIds: ["identificacao","ete","residuos","rotinas","fotos","documentos","validacao"] },
  { id: "factory-vazao-padrao", name: "Medição padrão", type: "vazao", moduleIds: MODULES_BY_TYPE.vazao },
  { id: "factory-outorga-padrao", name: "Processo de outorga", type: "outorga", moduleIds: MODULES_BY_TYPE.outorga },
  { id: "factory-outorga-renovacao", name: "Renovação de outorga", type: "outorga", moduleIds: ["identificacao","empreendimento","agua","pocos","outorga","documentos","fotos","validacao"] },
  { id: "factory-terreno-padrao", name: "Visita ao terreno", type: "terreno", moduleIds: MODULES_BY_TYPE.terreno },
];

/* =================== Overrides de estrutura =================== */

function reorder<T extends { id: string }>(arr: T[], order?: string[]): T[] {
  if (!order || !order.length) return arr;
  const map = new Map(arr.map((x) => [x.id, x]));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    const item = map.get(id);
    if (item) { out.push(item); seen.add(id); }
  }
  for (const item of arr) if (!seen.has(item.id)) out.push(item);
  return out;
}

function applyFieldPatch(field: FieldDef, patch?: import("./types").FieldPatch): FieldDef | null {
  if (!patch) return field;
  if (patch.hidden) return null;
  const { hidden: _h, required: _r, ...rest } = patch;
  return { ...field, ...rest };
}

/** Aplica overrides do usuário sobre uma lista de módulos (catálogo de fábrica). */
export function applyFormOverrides(
  list: ModuleDef[],
  overrides?: FormStructureOverrides,
): ModuleDef[] {
  if (!Array.isArray(list)) return [];
  if (!overrides) return list;
  const out: ModuleDef[] = [];
  for (const m of list) {
    const mp = overrides.modules?.[m.id];
    // Subgrupos: fábrica + customizados
    const baseSubs = (m.subgroups ?? []).slice();
    const custom = overrides.customSubgroups?.[m.id] ?? [];
    let subs: SubgroupDef[] = [...baseSubs, ...custom];
    // Aplica patches em subgrupo (título, hidden, ordem de campos)
    subs = subs
      .map((sg) => {
        const sp = overrides.subgroups?.[`${m.id}.${sg.id}`];
        if (sp?.hidden) return null;
        // patches dos campos + customFields
        const patchedFields = sg.fields
          .map((f) => applyFieldPatch(f, overrides.fields?.[`${m.id}.${sg.id}.${f.id}`]))
          .filter(Boolean) as FieldDef[];
        const customF = overrides.customFields?.[`${m.id}.${sg.id}`] ?? [];
        const allFields = reorder([...patchedFields, ...customF], sp?.fieldOrder);
        return {
          ...sg,
          title: sp?.title ?? sg.title,
          description: sp?.description ?? sg.description,
          fields: allFields,
        } as SubgroupDef;
      })
      .filter(Boolean) as SubgroupDef[];
    subs = reorder(subs, mp?.subgroupOrder);

    // Campos de nível do módulo (sem subgrupo)
    const moduleFields = m.fields
      .map((f) => applyFieldPatch(f, overrides.fields?.[`${m.id}._.${f.id}`]))
      .filter(Boolean) as FieldDef[];

    out.push({
      ...m,
      title: mp?.title ?? m.title,
      description: mp?.description ?? m.description,
      fields: moduleFields,
      subgroups: subs.length ? subs : m.subgroups,
    });
  }
  return out;
}

/** Versão "efetiva": catálogo de tipo + overrides do usuário aplicados. */
const EMPTY_OVERRIDES: FormStructureOverrides = {};
const effectiveTypeCache: WeakMap<FormStructureOverrides, Map<SurveyType, ModuleDef[]>> = new WeakMap();
const effectiveCustomCache: WeakMap<FormStructureOverrides, WeakMap<CustomSurveyType, ModuleDef[]>> = new WeakMap();

export function getEffectiveModulesForType(
  type: SurveyType,
  overrides?: FormStructureOverrides,
): ModuleDef[] {
  const cacheKey = overrides ?? EMPTY_OVERRIDES;
  let perType = effectiveTypeCache.get(cacheKey);
  if (!perType) {
    perType = new Map();
    effectiveTypeCache.set(cacheKey, perType);
  }
  const hit = perType.get(type);
  if (hit) return hit;
  const result = applyFormOverrides(getModulesForType(type), overrides);
  perType.set(type, result);
  return result;
}

/** Catálogo completo (todos os módulos do sistema, com overrides). */
export function getEffectiveAllModules(overrides?: FormStructureOverrides) {
  return applyFormOverrides(MODULES, overrides);
}

/**
 * Resolve módulos efetivos para um tipo personalizado.
 * Pipeline: catálogo base (somente módulos vinculados) → overrides globais → scopedOverrides do tipo.
 */
export function getEffectiveModulesForCustomType(
  customType: CustomSurveyType,
  globalOverrides?: FormStructureOverrides,
): ModuleDef[] {
  const cacheKey = globalOverrides ?? EMPTY_OVERRIDES;
  let perCt = effectiveCustomCache.get(cacheKey);
  if (!perCt) {
    perCt = new WeakMap();
    effectiveCustomCache.set(cacheKey, perCt);
  }
  const hit = perCt.get(customType);
  if (hit) return hit;
  const orderedIds = Array.isArray(customType.moduleBindings)
    ? customType.moduleBindings.map((b) => b.moduleId)
    : [];
  const base: ModuleDef[] = [];
  for (const id of orderedIds) {
    const m = MODULES_INDEX.get(id);
    if (m) base.push(m);
  }
  // Aplica overrides globais primeiro, depois os do tipo (scoped tem precedência).
  const afterGlobal = globalOverrides ? applyFormOverrides(base, globalOverrides) : base;
  const afterScoped = customType.scopedOverrides && typeof customType.scopedOverrides === "object"
    ? applyFormOverrides(afterGlobal, customType.scopedOverrides)
    : afterGlobal;
  perCt.set(customType, afterScoped);
  return afterScoped;
}

/** Adapter retrocompatível: gera valores novos a partir dos campos antigos. */
export function ensureLegacyAdapters(modules: Record<string, ModuleState>): Record<string, ModuleState> {
  const out = { ...modules };
  // Pessoas — colaborador
  const pessoas = out.pessoas;
  if (pessoas) {
    const v = { ...pessoas.values };
    let changed = false;
    if (!Array.isArray(v.colaboradores) && (v.colab_nome || v.colab_cargo || v.colab_telefone || v.colab_email)) {
      const p: Person = { id: "legacy-colab", nome: String(v.colab_nome ?? ""), cargo: v.colab_cargo, telefone: v.colab_telefone, email: v.colab_email };
      v.colaboradores = [p];
      changed = true;
    }
    if (!Array.isArray(v.tecnicos) && (v.tec_nome || v.tec_cargo || v.tec_registro || v.tec_telefone || v.tec_email)) {
      const p: Person = { id: "legacy-tec", nome: String(v.tec_nome ?? ""), cargo: v.tec_cargo, registro: v.tec_registro, telefone: v.tec_telefone, email: v.tec_email };
      v.tecnicos = [p];
      changed = true;
    }
    if (!Array.isArray(v.outros_pessoas) && typeof v.outros_presentes === "string" && v.outros_presentes.trim()) {
      v.outros_pessoas = [{ id: "legacy-outros", nome: v.outros_presentes }];
      changed = true;
    }
    if (changed) out.pessoas = { ...pessoas, values: v };
  }
  // Operação — funcionamento
  const oper = out.operacionais;
  if (oper) {
    const v = { ...oper.values };
    if (!v.funcionamento || typeof v.funcionamento !== "object") {
      const hasLegacy = v.horario_inicio || v.horario_fim || v.horario_func || (Array.isArray(v.dias_semana) && v.dias_semana.length);
      if (hasLegacy) {
        const hv: HoursValue = {
          preset: "outro",
          dias: Array.isArray(v.dias_semana) ? (v.dias_semana as string[]) : undefined,
          turnos: v.horario_inicio || v.horario_fim
            ? [{ id: "t1", inicio: String(v.horario_inicio ?? ""), fim: String(v.horario_fim ?? "") }]
            : [],
          observacao: typeof v.horario_func === "string" ? v.horario_func : undefined,
        };
        v.funcionamento = hv;
        out.operacionais = { ...oper, values: v };
      }
    }
  }
  return out;
}
