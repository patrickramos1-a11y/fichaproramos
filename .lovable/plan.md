
# Refator final — leitura, mobile e performance

Objetivo: chegar à versão final com **menos código, mais rápido, mobile-first** e com identidade visual única (verde institucional `#0dd375`, branco, cinza técnico `#5b5b5b`). A experiência principal de um levantamento passa a ser **ler o relatório consolidado**; editar é um modo secundário acessado por drawer.

---

## 1. Identidade visual unificada

Reescrever `src/styles.css` com **um único** sistema de tokens em `oklch`:

- `--background: #ffffff`
- `--primary: #0dd375` (verde institucional — botões, links ativos, ícones, gráficos)
- `--foreground: #1a1a1a` (texto principal)
- `--muted-foreground: #5b5b5b` (cinza técnico — secundário, legendas, tabelas, rodapés)
- `--border: oklch` derivado do cinza a 88% L
- `--card: #ffffff` com sombra discreta
- Status: verde primário (concluído), cinza (não iniciado), borda âmbar suave (pendente). **Sem** roxo, azul, vermelho saturado — só usar tom de aviso quando estritamente necessário.
- Tipografia: **Inter** (corpo) + **Inter tight/medium** para títulos. `font-display: swap`. Sem serifa.
- Raio: `--radius: 10px`. Sombra única padronizada `--shadow-card`.
- Substituir todo uso direto de cor (`text-blue-600`, `bg-zinc-50`, `border-slate-200`, `style={{ borderColor: "var(--status-progress)" }}`, etc.) por tokens semânticos.

Entregável: nenhum componente referenciando cores fora do token set.

---

## 2. Poda agressiva (remover o que não virou experiência principal)

Arquivos/áreas a **remover**:

- `src/routes/levantamentos.$id.resumo.tsx` (resumo paralelo legado).
- Tabs virtuais "Documentos", "Pendências", "Encerramento" do editor antigo — viram seções dentro do Relatório/Visão.
- Bloco de "Etapa de configuração inicial" como tela separada → vira modal/drawer leve quando o levantamento ainda não tem módulos.
- Painéis/contadores duplicados no topo do `levantamentos.$id.index.tsx` (chips de finalidade + contadores soltos + lista de módulos colapsáveis): tudo isso já existe na Visão Consolidada.
- `FieldRenderer.tsx` (1016 linhas): quebrar em arquivos por tipo de campo (`fields/TextField.tsx`, `NumberField.tsx`, `RepeaterField.tsx`, `PersonnelField.tsx`, `CoordsField.tsx`, etc.) e um `FieldRenderer` slim que faz só o switch. Remover variantes de UI não usadas.
- `ModuleConfigStep.tsx`: simplificar para um único passo enxuto dentro de drawer.
- Imports e helpers órfãos em `lib/store.ts` e `lib/modules.ts` (varredura `ts-prune` mental durante o refator).

A camada de **edição por módulo continua existindo**, mas só acessível via:
- Botão "Editar" em cada bloco do Relatório → abre `QuickEditDrawer` com o subgrupo certo.
- Botão "Modo avançado" no header → abre uma **rota dedicada** `/levantamentos/$id/editar` (extraída do route file gigante atual), carregada sob demanda.

---

## 3. Nova arquitetura da tela de levantamento

`src/routes/levantamentos.$id.index.tsx` hoje tem 1036 linhas e mistura: header, configuração, editor, tabs, documentos, pendências, encerramento, visão consolidada e relatório. Vai ser quebrado em:

```text
src/routes/
  levantamentos.$id.index.tsx       (slim, <120 linhas: layout + decide view)
  levantamentos.$id.editar.tsx      (modo avançado, lazy)
src/components/survey/
  SurveyHeader.tsx                  (título, cliente, status, ações)
  SurveyTabs.tsx                    (Visão | Relatório | Anexos)
  VisaoConsolidada.tsx              (mantém, limpo)
  RelatorioDetalhado.tsx            (mantém, limpo)
  AnexosPanel.tsx                   (consolida documentos + fotos + áudios)
  PendenciasInline.tsx              (some como tab; vira seção do Relatório)
  QuickEditDrawer.tsx               (mantém, base da edição)
  edit/
    SubgroupEditor.tsx              (usado pelo drawer e pelo modo avançado)
    fields/*                         (campos quebrados)
```

Tabs reduzidas de 5 para **3**: `Visão` · `Relatório` · `Anexos`. Pendências e encerramento vivem dentro da Visão.

---

## 4. Mobile-first com top nav

Mantemos a barra superior. Mudanças:

- Header `AppShell`: 56px de altura no mobile, ícones + label curto, scroll horizontal suave quando passar da largura. No desktop continua igual.
- Toda a página de levantamento vira **uma coluna**, com cards full-width, padding 16px no mobile e 24px no desktop. Nenhum grid 2-col que quebre abaixo de 768px.
- Tabs de levantamento: pílulas roláveis horizontalmente (snap), sem dropdown.
- `QuickEditDrawer`: `Sheet` de baixo no mobile (full-height), lateral direita no desktop.
- Inputs: altura mínima 44px, `font-size: 16px` (evita zoom iOS), botões de ação com `min-h-12` e tap target 48px.
- Listas (clientes/projetos/levantamentos): cards verticais no mobile, tabela só ≥ md.
- Toda imagem com `width`/`height` explícitos para remover CLS.

Acessibilidade: foco visível verde, `prefers-reduced-motion` desabilita transições, contraste cinza/branco validado.

---

## 5. Performance — ataque por área

A lentidão hoje vem de quatro causas que vou atacar diretamente:

### a) Re-render global a cada digitação
`useDBSelector` re-roda toda função `selector` no store inteiro a cada `emit()`, e `setFieldValue` chama `persist()` (que faz `emit()` global) a cada caractere. Plano:
- **Debounce** `setFieldValue` em 250ms para texto/número (commit imediato em blur). Status/anexos continuam síncronos.
- Trocar `useDBSelector` por seletores escopados por `surveyId` que comparam por referência da sub-árvore (`state.surveys.find(...)`), e usar `useSyncExternalStore` com `getSnapshot` que retorna **só o survey** alvo.
- Memoizar `useEffectiveModulesForSurvey` por `(type, customTypeId, overridesVersion)` (um contador incrementado só quando overrides mudam) em vez de recomputar a cada render.

### b) `lib/modules.ts` (1613 linhas) recomputando estrutura
- Cache em `Map` por `surveyType+customTypeId` para `getEffectiveModulesForType*`.
- Mover funções pesadas (`computeModuleStatus`, `subgroupProgress`) para receber valores já normalizados e não percorrer arrays de campos a cada chamada.
- Pré-calcular um índice `subgroup → fields[]` no momento em que o módulo é resolvido.

### c) Listas pesadas
- Clientes/Projetos/Levantamentos: paginação local de 50 itens + filtro com `useDeferredValue`.
- `levantamentos.index.tsx`: trocar `surveys.map` que reconsulta `clients`/`projects` por um `Map` pré-calculado uma vez.
- Adicionar `react-window` apenas se passar de ~200 itens (gate dinâmico, não import obrigatório).

### d) Code splitting e bundle
- `lazy()` para: `RelatorioDetalhado`, `levantamentos.$id.editar`, `configuracoes.tipos.$typeId` (895 linhas), `MapView` (já feito), `PhotoChecklist`, `kmlExport`.
- Remover imports `lucide-react` em barril; importar ícones individuais (já é o caso, validar).
- Garantir que `demoSeed.ts` (526 linhas) é dynamic-import só quando o usuário aciona "carregar demo".
- `FieldRenderer` quebrado também reduz o JS inicial da rota de edição.

### e) Persistência
- Trocar `queueSync` atual por **batching** real: agrupar todas as mutações de 500ms em um único upsert por tabela. Hoje cada `persist()` agenda sync individual.
- `saveSnapshot` (offline) só roda em `requestIdleCallback`.

Meta: TTI da rota `/levantamentos/:id` < 1s em desktop, < 2s em 4G mobile; digitar em campo de texto sem frame drop.

---

## 6. Ordem de execução (entregável por etapa, sem quebrar o app)

1. **Tokens e identidade visual** — `styles.css` + sweep de cores hardcoded.
2. **AppShell mobile-first** — header novo, tap targets, tabs roláveis.
3. **Quebrar `levantamentos.$id.index.tsx`** em rotas/componentes; remover tabs centrais e tela de configuração standalone.
4. **Quebrar `FieldRenderer`** em campos por arquivo, lazy onde fizer sentido.
5. **Performance store**: debounce, seletores escopados, cache de `modules`.
6. **Listas**: `useDeferredValue`, mapas pré-calculados, paginação leve.
7. **Code splitting**: `lazy()` nas rotas/componentes pesados.
8. **Poda final**: deletar arquivos legados, rodar `tsc` e remover imports órfãos.
9. **QA mobile real**: percorrer fluxo completo no viewport 375px e validar.

Cada etapa é um commit independente — se algo der errado, dá para parar entre elas sem deixar o app quebrado.

---

## Detalhes técnicos

- Stack: TanStack Start, React 19, Zustand-like store custom (`useSyncExternalStore`), Tailwind v4, shadcn/ui, Supabase (Lovable Cloud).
- Não há mudança de schema do banco. Todo o refator é frontend.
- `lib/store.ts` e `lib/modules.ts` continuam existindo, só ficam mais magros e com cache.
- `routeTree.gen.ts` regenera sozinho ao adicionar/remover rotas — não vou editar à mão.
- Risco principal: regressões em campos raros do `FieldRenderer` ao quebrar. Mitigação: manter o switch central com fallback para o componente antigo durante 1 etapa, depois remover.

Posso começar pela etapa 1 (tokens + identidade) assim que você aprovar.
