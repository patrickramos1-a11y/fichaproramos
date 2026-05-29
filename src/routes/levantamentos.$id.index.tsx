import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useCallback, useEffect, useMemo, useState, lazy, Suspense, type ChangeEvent } from "react";
import {
  useDBSelector, updateModule, setFieldValue, setFieldStatus, addAttachment,
  removeAttachment, addPendencia, removePendencia, setFieldNote, setFieldNA,
  setEnabledModules, useDBStatus, setModuleNA, setSubgroupNA, enableModule,
  closeSurveyWithAutoNA, reopenSurvey, addTemplate, setSubgroupNote, setModuleDone,
  setSubgroupDone, useEffectiveModulesForSurvey, useSurveyTypeMeta, ensureSurveyPublicShare,
} from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, FileText, Paperclip, Plus, Trash2, AlertTriangle, CheckCircle2,
  FileDown, Settings2, Files, ClipboardList, Signature, ChevronRight, Ban, Check, EyeOff,
  Lock, Unlock, Clock, Save, MessageSquarePlus,
  BookOpen, ListChecks, Share2,
} from "lucide-react";
import {
  shouldShowField, CENTRAL_TAB_MODULES,
  computeModuleStatus, computeSubgroupStatus, subgroupProgress,
} from "@/lib/modules";
import { FieldRenderer } from "@/components/FieldRenderer";
import { StatusBadge } from "@/components/StatusBadge";
import { ModuleConfigStep } from "@/components/ModuleConfigStep";
import { PhotoChecklist } from "@/components/PhotoChecklist";
import { PhotoAttachmentsPanel } from "@/components/PhotoAttachmentsPanel";
import { type FieldStatus, type FieldDef, type SubgroupDef, type ModuleState } from "@/lib/types";
import { GeometryManager } from "@/components/geom/GeometryManager";
import type { SurveyGeometry } from "@/lib/geometryTypes";
import { statusOutlineStyle } from "@/lib/colors";
import { FinalidadeCard } from "@/components/FinalidadeCard";
import { VisaoConsolidada } from "@/components/survey/VisaoConsolidada";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
const RelatorioDetalhado = lazy(() =>
  import("@/components/survey/RelatorioDetalhado").then((m) => ({ default: m.RelatorioDetalhado })),
);

export const Route = createFileRoute("/levantamentos/$id/")({
  component: SurveyEditor,
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode === "read" ? "read" : "edit") as "read" | "edit",
  }),
});

type VirtualTab = "__documentos" | "__pendencias" | "__encerramento";

function SurveyEditor() {
  const { id } = Route.useParams();
  const { mode } = Route.useSearch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { hydrated, persistPending, persistenceError } = useDBStatus();
  const data = useDBSelector(
    (state) => {
      const survey = state.surveys.find((s) => s.id === id);
      const project = survey ? getSurveyProject(survey, state.projects) ?? null : null;
      const client = survey ? getSurveyClient(survey, state.clients, state.projects) ?? null : null;
      return { survey, project, client };
    },
    (a, b) => a.survey === b.survey && a.project === b.project && a.client === b.client,
  );
  const { survey, project, client } = data;

  const [activeTab, setActiveTab] = useState<string>("identificacao");

  if (!mounted || !hydrated) return <AppShell><p>Carregando levantamento...</p></AppShell>;
  if (!survey) return <AppShell><p>Levantamento não encontrado.</p></AppShell>;

  // ---- Etapa de configuração inicial ----
  if (!survey.enabledModules || survey.enabledModules.length === 0) {
    return (
      <AppShell>
        <Link to="/levantamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-4 w-4" /> Levantamentos
        </Link>
        <div className="mb-4">
          <div className="text-xs text-muted-foreground">
            {[client?.name, project?.name].filter(Boolean).join(" / ") || "Levantamento sem cliente identificado"}
          </div>
          <h1 className="text-2xl font-semibold">{survey.title}</h1>
          {(persistPending || persistenceError) && <p className="text-xs text-muted-foreground mt-1">{persistenceError ?? "Salvando alterações..."}</p>}
        </div>
        <ModuleConfigStep
          surveyType={survey.type}
          onConfirm={(ids) => setEnabledModules(survey.id, ids.length ? ids : ["identificacao", "validacao"])}
        />
      </AppShell>
    );
  }

  return (
    <SurveyEditorReady
      survey={survey}
      projectName={project?.name ?? ""}
      clientName={client?.name ?? ""}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      persistPending={persistPending}
      persistenceError={persistenceError}
      mode={mode}
    />
  );
}

function SurveyEditorReady({ survey, projectName, clientName, activeTab, setActiveTab, persistPending, persistenceError, mode }: {
  survey: any; projectName: string; clientName: string; activeTab: string; setActiveTab: (t: string) => void; persistPending?: boolean; persistenceError?: string; mode: "read" | "edit";
}) {
  // No modo operacional ("edit", vindo da aba Levantamentos), o foco é preencher.
  // No modo leitura ("read", vindo da página do cliente/projeto), o foco é consultar.
  const [view, setView] = useState<"consolidada" | "relatorio" | "editor" | "anexos" | "pendencias">(
    mode === "read" ? "consolidada" : "editor",
  );
  const isReadMode = mode === "read";
  const allModules = useEffectiveModulesForSurvey(survey);
  const enabled: string[] = survey.enabledModules ?? allModules.map((m: any) => m.id);
  const enabledSet = useMemo(() => new Set(enabled), [enabled]);
  // Tabs comuns (módulos habilitados que não são centralizados)
  const regularTabs = allModules.filter((m) => enabledSet.has(m.id) && !CENTRAL_TAB_MODULES.has(m.id));
  const hasDocs = enabledSet.has("documentos");
  const hasValidacao = enabledSet.has("validacao");

  // Módulos disponíveis mas não selecionados (excluindo centrais e obrigatórios)
  const hiddenModules = allModules.filter(
    (m) => !enabledSet.has(m.id) && !CENTRAL_TAB_MODULES.has(m.id),
  );

  // Contadores agregados
  const counters = useMemo(() => {
    const c = { concluido: 0, em_andamento: 0, nao_iniciado: 0, nao_se_aplica: 0, pendente: 0 };
    for (const m of regularTabs) {
      const st = computeModuleStatus(m, survey.modules[m.id] as ModuleState);
      if (st === "concluido") c.concluido++;
      else if (st === "em_andamento") c.em_andamento++;
      else if (st === "nao_se_aplica") c.nao_se_aplica++;
      else if (st === "pendente") c.pendente++;
      else c.nao_iniciado++;
    }
    return c;
  }, [regularTabs, survey.modules]);

  const typeMeta = useSurveyTypeMeta(survey.type, survey.customTypeId);
  const typeLabel = typeMeta.label;

  const isVirtual = activeTab === "__documentos" || activeTab === "__pendencias" || activeTab === "__encerramento";
  const activeModule = !isVirtual ? regularTabs.find((m) => m.id === activeTab) ?? regularTabs[0] : null;

  return (
    <AppShell>
      <Link to="/levantamentos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Levantamentos
      </Link>

      {/* Cabeçalho compacto */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground truncate">
            {[clientName, projectName].filter(Boolean).join(" / ") || "Levantamento"} · {typeLabel}
          </div>
          <h1 className="text-base font-semibold flex items-center gap-2 truncate">
            <span className="truncate">{survey.title}</span>
            {survey.closedAt && (
              <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-normal shrink-0" style={{ borderColor: "var(--status-done)", color: "var(--status-done)" }}>
                <Lock className="h-2.5 w-2.5" /> Encerrado
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reconfigurar módulos" onClick={() => setEnabledModules(survey.id, [])}>
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Salvar como template" onClick={() => {
            const name = window.prompt("Nome do template (módulos selecionados serão salvos):");
            if (!name?.trim()) return;
            addTemplate({ name: name.trim(), type: survey.type, moduleIds: enabled });
          }}>
            <Save className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link externo de preenchimento" onClick={async () => {
            const token = ensureSurveyPublicShare(survey.id);
            if (!token) return;
            const url = `${window.location.origin}/preencher/${token}`;
            try {
              await navigator.clipboard?.writeText(url);
              window.alert("Link externo copiado. Quem acessar sem login verá somente este levantamento.");
            } catch {
              window.prompt("Copie o link externo:", url);
            }
          }}>
            <Share2 className="h-4 w-4" />
          </Button>
          {survey.closedAt && (
            <Link to="/levantamentos/$id/resumo" params={{ id: survey.id }}>
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver resumo final"><FileDown className="h-4 w-4" /></Button>
            </Link>
          )}
        </div>
      </div>

      {isReadMode ? (
        <div className="mb-3 flex items-center gap-1 border-b border-border overflow-x-auto">
          {([
            { id: "consolidada", label: "Visão Consolidada" },
            { id: "relatorio", label: "Relatório Detalhado" },
            { id: "editor", label: "Editar por módulos" },
            { id: "anexos", label: "Fotos & Documentos" },
            { id: "pendencias", label: "Pendências" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${view === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        // Modo operacional: foco em preencher. Visão/Relatório como ações secundárias.
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1 inline-flex items-center gap-1">
            <ListChecks className="h-3 w-3" /> Preenchimento do levantamento
          </span>
          <Button
            size="sm"
            variant={view === "consolidada" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setView(view === "consolidada" ? "editor" : "consolidada")}
            title="Ver visão consolidada"
          >
            <BookOpen className="h-3.5 w-3.5 mr-1" /> Consolidada
          </Button>
          {survey.closedAt && (
            <Button
              size="sm"
              variant={view === "relatorio" ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setView(view === "relatorio" ? "editor" : "relatorio")}
              title="Ver relatório detalhado"
            >
              <FileText className="h-3.5 w-3.5 mr-1" /> Relatório
            </Button>
          )}
        </div>
      )}

      {view === "consolidada" && (
        <VisaoConsolidada
          surveyId={survey.id}
          onOpenEditor={(modId) => { setView("editor"); if (modId) setActiveTab(modId); }}
        />
      )}

      {view === "relatorio" && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando relatório…</p>}>
          <RelatorioDetalhado
            surveyId={survey.id}
            onOpenEditor={(modId) => { setView("editor"); if (modId) setActiveTab(modId); }}
          />
        </Suspense>
      )}

      {view === "anexos" && <DocumentsPanel survey={survey} />}
      {view === "pendencias" && <PendenciasPanel survey={survey} />}

      {view === "editor" && (<>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-[11px]">
        <CounterChip tone="done" icon={<Check className="h-3 w-3" />} value={counters.concluido} label="ok" />
        <CounterChip tone="progress" value={counters.em_andamento} label="andamento" />
        <CounterChip tone="todo" value={counters.nao_iniciado} label="a fazer" />
        {counters.nao_se_aplica > 0 && <CounterChip tone="na" value={counters.nao_se_aplica} label="N/A" />}
        {counters.pendente > 0 && <CounterChip tone="pending" value={counters.pendente} label="pend." />}
        {(persistPending || persistenceError) && <span className="text-muted-foreground ml-1 truncate">{persistenceError ?? "Salvando..."}</span>}
      </div>

      {/* Tabs de módulos com N/A inline */}
      <ModuleTabsBar
        survey={survey}
        regularTabs={regularTabs}
        hiddenModules={hiddenModules}
        hasDocs={hasDocs}
        hasValidacao={hasValidacao}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {activeModule && (
        <ModulePanel
          survey={survey}
          module={activeModule}
          onModuleDone={() => {
            // Navega para próximo módulo aberto
            const remaining = regularTabs.filter((m) => {
              if (m.id === activeModule.id) return false;
              const st = survey.modules[m.id] as ModuleState;
              if (st?.naModule || st?.moduleDone) return false;
              return true;
            });
            const currentIdx = regularTabs.findIndex((m) => m.id === activeModule.id);
            const next = remaining.find((m) => regularTabs.indexOf(m) > currentIdx) ?? remaining[0];
            if (next) setActiveTab(next.id);
            else setActiveTab("__encerramento");
          }}
        />
      )}
      {activeTab === "__documentos" && <DocumentsPanel survey={survey} />}
      {activeTab === "__pendencias" && <PendenciasPanel survey={survey} />}
      {activeTab === "__encerramento" && <EncerramentoPanel survey={survey} />}
      </>)}
    </AppShell>
  );
}

function statusVarSuffix(s: FieldStatus): string {
  switch (s) {
    case "nao_iniciado": return "todo";
    case "em_andamento": return "progress";
    case "concluido": return "done";
    case "pendente": return "pending";
    case "nao_se_aplica": return "na";
    case "aguardando_documento": return "doc";
    case "aguardando_empresa": return "company";
    case "requer_retorno": return "return";
  }
}

function ModuleTabsBar({ survey, regularTabs, hiddenModules, hasDocs, hasValidacao, activeTab, setActiveTab }: {
  survey: any; regularTabs: any[]; hiddenModules: any[]; hasDocs: boolean; hasValidacao: boolean;
  activeTab: string; setActiveTab: (t: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const doneTabs = regularTabs.filter((m) => {
    const st = survey.modules[m.id] as ModuleState;
    if (st?.naModule) return false;
    return computeModuleStatus(m, st) === "concluido";
  });
  const doneIds = new Set(doneTabs.map((m) => m.id));
  const visibleTabs = regularTabs.filter((m) => {
    const st = survey.modules[m.id] as ModuleState;
    if (st?.naModule) return false;
    if (doneIds.has(m.id)) return false;
    return true;
  });
  const naTabs = regularTabs.filter((m) => (survey.modules[m.id] as ModuleState)?.naModule);
  const progressTabs = visibleTabs.filter((m) => computeModuleStatus(m, survey.modules[m.id] as ModuleState) !== "nao_iniciado");
  const todoTabs = visibleTabs.filter((m) => computeModuleStatus(m, survey.modules[m.id] as ModuleState) === "nao_iniciado");

  const renderModuleChip = (m: any) => {
    const st = survey.modules[m.id] as ModuleState;
    const eff = computeModuleStatus(m, st);
    const active = activeTab === m.id;
    return (
      <div key={m.id} className="inline-flex min-w-0 items-stretch rounded-md border overflow-hidden"
        style={{ borderColor: active ? "var(--primary)" : "var(--border)" }}
      >
        <button
          onClick={() => setActiveTab(m.id)}
          className={`min-w-0 px-2.5 py-1.5 text-xs whitespace-normal text-left flex items-center gap-1.5 ${active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: `var(--status-${statusVarSuffix(eff)})` }} />
          <span className="min-w-0 break-words">{m.title}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setModuleNA(survey.id, m.id, true); }}
          title="Marcar como não se aplica"
          className={`px-1.5 border-l flex items-center shrink-0 ${active ? "bg-primary/90 text-primary-foreground border-primary-foreground/30 hover:bg-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
        >
          <Ban className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 mb-1.5">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title={collapsed ? "Expandir abas" : "Recolher abas"}
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`} />
          {visibleTabs.length} módulos
          {naTabs.length > 0 && <span className="ml-1 opacity-70">· {naTabs.length} N/A</span>}
        </button>
      </div>
      {!collapsed && (
        <div className="-mx-1 px-1">
          <div className="grid gap-2 pb-1">
            {progressTabs.length > 0 && <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">Em andamento</div>}
            {progressTabs.length > 0 && <div className="flex flex-wrap gap-1.5">{progressTabs.map(renderModuleChip)}</div>}
            {todoTabs.length > 0 && <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">A fazer</div>}
            {todoTabs.length > 0 && <div className="flex flex-wrap gap-1.5">{todoTabs.map(renderModuleChip)}</div>}
            <div className="flex flex-wrap items-center gap-1.5">
            {naTabs.length > 0 && (
              <NaModulesPill survey={survey} na={naTabs} activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
            {doneTabs.length > 0 && (
              <DoneModulesPill survey={survey} done={doneTabs} activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
            {hiddenModules.length > 0 && (
              <HiddenModulesPill survey={survey} hidden={hiddenModules} />
            )}
            {(naTabs.length > 0 || doneTabs.length > 0 || hiddenModules.length > 0) && (
              <span className="self-center text-muted-foreground mx-1">·</span>
            )}
            {hasDocs && (
              <TabPill icon={<Files className="h-3 w-3" />} active={activeTab === "__documentos"} onClick={() => setActiveTab("__documentos")}>Docs</TabPill>
            )}
            <TabPill icon={<ClipboardList className="h-3 w-3" />} active={activeTab === "__pendencias"} onClick={() => setActiveTab("__pendencias")}>
              Pend.{survey.pendencias.length > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-[var(--status-pending)] text-white text-[10px] h-4 min-w-4 px-1">{survey.pendencias.length}</span>}
            </TabPill>
            {hasValidacao && (
              <TabPill icon={<Signature className="h-3 w-3" />} active={activeTab === "__encerramento"} onClick={() => setActiveTab("__encerramento")}>Encerrar</TabPill>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

function NaModulesPill({ survey, na, activeTab, setActiveTab }: { survey: any; na: any[]; activeTab: string; setActiveTab: (t: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="rounded-md px-2.5 py-1 text-xs whitespace-nowrap inline-flex items-center gap-1.5 border border-dashed border-border bg-card hover:bg-secondary text-muted-foreground"
          title="Módulos marcados como N/A"
        >
          <Ban className="h-3 w-3" /> {na.length} N/A
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">Módulos N/A</div>
        <div className="grid gap-1 max-h-72 overflow-auto">
          {na.map((m) => {
            const active = activeTab === m.id;
            return (
              <div key={m.id} className="flex items-center gap-1">
                <button
                  className={`flex-1 text-left text-sm rounded-md px-2 py-1.5 hover:bg-secondary inline-flex items-center gap-2 ${active ? "bg-secondary" : ""}`}
                  onClick={() => setActiveTab(m.id)}
                >
                  <Ban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 break-words">{m.title}</span>
                </button>
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground rounded-md px-2 py-1 hover:bg-secondary"
                  onClick={() => setModuleNA(survey.id, m.id, false)}
                  title="Reabrir módulo"
                >
                  Reabrir
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DoneModulesPill({ survey, done, activeTab, setActiveTab }: { survey: any; done: any[]; activeTab: string; setActiveTab: (t: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="rounded-md px-2.5 py-1 text-xs whitespace-nowrap inline-flex items-center gap-1.5 border"
          style={{ borderColor: "var(--status-done)", color: "var(--status-done)", backgroundColor: "color-mix(in oklab, var(--status-done) 12%, transparent)" }}
          title="Módulos concluídos"
        >
          <Check className="h-3 w-3" /> {done.length} concluído{done.length > 1 ? "s" : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">Módulos concluídos</div>
        <div className="grid gap-1 max-h-72 overflow-auto">
          {done.map((m) => {
            const active = activeTab === m.id;
            return (
              <div key={m.id} className="flex items-center gap-1">
                <button
                  className={`flex-1 text-left text-sm rounded-md px-2 py-1.5 hover:bg-secondary inline-flex items-center gap-2 ${active ? "bg-secondary" : ""}`}
                  onClick={() => setActiveTab(m.id)}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--status-done)" }} />
                  <span className="truncate">{m.title}</span>
                </button>
                <button
                  className="text-[11px] text-muted-foreground hover:text-foreground rounded-md px-2 py-1 hover:bg-secondary"
                  onClick={() => setModuleDone(survey.id, m.id, false)}
                  title="Reabrir módulo"
                >
                  Reabrir
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TabPill({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs transition-colors whitespace-nowrap flex items-center gap-1.5 border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-secondary"}`}
    >
      {icon} {children}
    </button>
  );
}

function CounterChip({ value, label, tone, icon }: { value: number; label: string; tone: "done" | "progress" | "todo" | "na" | "pending"; icon?: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
      style={{ borderColor: `color-mix(in oklab, var(--status-${tone}) 40%, transparent)`, color: `var(--status-${tone})`, backgroundColor: `color-mix(in oklab, var(--status-${tone}) 12%, transparent)` }}
    >
      {icon}
      <strong className="font-semibold">{value}</strong>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function HiddenModulesPill({ survey, hidden }: { survey: any; hidden: any[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap flex items-center gap-1.5 border border-dashed border-border bg-card hover:bg-secondary text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" /> +{hidden.length} não selecionados
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">Módulos disponíveis</div>
        <div className="grid gap-1 max-h-72 overflow-auto">
          {hidden.map((m) => (
            <button
              key={m.id}
              className="text-left text-sm rounded-md px-2 py-1.5 hover:bg-secondary flex items-center justify-between gap-2"
              onClick={() => enableModule(survey.id, m.id)}
            >
              <span className="truncate">{m.title}</span>
              <span className="text-xs text-primary shrink-0">Ativar</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// =========================== ModulePanel ============================

function ModulePanel({ survey, module: m, onModuleDone }: { survey: any; module: any; onModuleDone?: () => void }) {
  const state = survey.modules[m.id] as ModuleState;
  const values = state.values;
  const fieldStatusMap = state.fieldStatus;
  const fieldNotes = state.fieldNotes ?? {};
  const naMap = state.nonApplicable ?? {};
  const naSubMap = state.naSubgroups ?? {};
  const subDoneMap = state.subgroupDone ?? {};
  const effective = computeModuleStatus(m, state);

  const subgroups: SubgroupDef[] = m.subgroups ?? [];

  const handleFieldChange = useCallback((fieldId: string, value: unknown) => {
    setFieldValue(survey.id, m.id, fieldId, value);
  }, [survey.id, m.id]);
  const handleFieldStatus = useCallback((fieldId: string, s: FieldStatus) => setFieldStatus(survey.id, m.id, fieldId, s), [survey.id, m.id]);
  const handleNote = useCallback((fieldId: string, note: string) => setFieldNote(survey.id, m.id, fieldId, note), [survey.id, m.id]);
  const handleNA = useCallback((fieldId: string, na: boolean) => setFieldNA(survey.id, m.id, fieldId, na), [survey.id, m.id]);

  function renderField(f: FieldDef, display: "active" | "review" = "active") {
    if (!shouldShowField(f, values)) return null;
    return (
      <FieldRenderer
        key={f.id}
        field={f}
        value={values[f.id]}
        status={fieldStatusMap[f.id] || "nao_iniciado"}
        note={fieldNotes[f.id]}
        na={!!naMap[f.id]}
        onChange={(v) => handleFieldChange(f.id, v)}
        onStatus={(s) => handleFieldStatus(f.id, s)}
        onNote={(n) => handleNote(f.id, n)}
        onNA={(na) => handleNA(f.id, na)}
        moduleValues={values}
        display={display}
      />
    );
  }
  const locationFields = m.id === "localizacao"
    ? [...m.fields, ...subgroups.flatMap((sg: SubgroupDef) => sg.fields)]
    : m.fields;
  const locationCoordFields = locationFields.filter((f: FieldDef) => f.type === "coords");
  const locationGeometries: SurveyGeometry[] = m.id === "localizacao"
    ? [
        ...(Array.isArray(values.pontos_gps) ? values.pontos_gps as SurveyGeometry[] : []),
        ...(Array.isArray(values.linhas_gps) ? values.linhas_gps as SurveyGeometry[] : []),
        ...(Array.isArray(values.poligonos_gps) ? values.poligonos_gps as SurveyGeometry[] : []),
      ]
    : [];
  function handleLocationGeometriesChange(next: SurveyGeometry[]) {
    const points = next.filter((g) => g.kind === "point");
    const lines = next.filter((g) => g.kind === "line");
    const polygons = next.filter((g) => g.kind === "polygon");
    handleFieldChange("pontos_gps", points);
    handleFieldChange("linhas_gps", lines);
    handleFieldChange("poligonos_gps", polygons);
    handleFieldStatus("pontos_gps", points.length ? "concluido" : "nao_iniciado");
    handleFieldStatus("linhas_gps", lines.length ? "concluido" : "nao_iniciado");
    handleFieldStatus("poligonos_gps", polygons.length ? "concluido" : "nao_iniciado");
  }

  // Módulo inteiro marcado como N/A → render compacto
  if (state.naModule) {
    return (
      <Card style={statusOutlineStyle("na")}>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{m.title}</div>
            <div className="text-xs text-muted-foreground">Marcado como não se aplica neste levantamento.</div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setModuleNA(survey.id, m.id, false)}>Reabrir módulo</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={statusOutlineStyle(statusVarSuffix(effective))}>
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 min-w-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2 break-words">
              {m.title}
              {effective === "concluido" && <Check className="h-5 w-5" style={{ color: "var(--status-done)" }} />}
            </h2>
            {m.description && <p className="text-sm text-muted-foreground break-words">{m.description}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 shrink-0 w-full sm:w-auto">
            <StatusBadge status={effective} />
            {state.moduleDone ? (
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setModuleDone(survey.id, m.id, false)} title="Reabrir módulo">
                <Unlock className="h-3.5 w-3.5 mr-1" /> Reabrir
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => { setModuleDone(survey.id, m.id, true); onModuleDone?.(); }}
                title="Concluir módulo"
                style={{ borderColor: "var(--status-done)", color: "var(--status-done)" }}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Concluir
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setModuleNA(survey.id, m.id, true)} title="Marcar módulo como não se aplica">
              <Ban className="h-3.5 w-3.5 mr-1" /> N/A
            </Button>
          </div>
        </div>

        {m.id === "fotos" && (
          <div className="mb-3">
            <PhotoChecklist survey={survey} moduleState={state} />
          </div>
        )}

        {m.id === "localizacao" ? (
          <div className="grid gap-3">
            {locationCoordFields.length > 0 && (
              <div className="grid gap-2.5">
                {locationCoordFields.map((f: FieldDef) => renderField(f))}
              </div>
            )}
            <div className="rounded-lg border bg-card/60 p-3 min-w-0">
              <GeometryManager
                value={locationGeometries}
                onChange={handleLocationGeometriesChange}
                exportName="Localizacao e Coordenadas"
              />
            </div>
          </div>
        ) : (
          m.fields.length > 0 && <div className="grid gap-2.5">{m.fields.map((f: FieldDef) => renderField(f))}</div>
        )}

        {m.id !== "fotos" && m.id !== "localizacao" && subgroups.length > 0 && (
          <div className="mt-3 grid gap-2">
            {subgroups.map((sg: SubgroupDef) => (
              <SubgroupBlock
                key={sg.id}
                subgroup={sg}
                renderField={renderField}
                state={state}
                isNA={!!naSubMap[sg.id]}
                onToggleNA={(na) => setSubgroupNA(survey.id, m.id, sg.id, na)}
                isDone={!!subDoneMap[sg.id]}
                onToggleDone={(done) => setSubgroupDone(survey.id, m.id, sg.id, done)}
                note={state.subgroupNotes?.[sg.id]}
                onNote={(n) => setSubgroupNote(survey.id, m.id, sg.id, n)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubgroupBlock({ subgroup, renderField, state, isNA, onToggleNA, isDone, onToggleDone, forceOpen, note, onNote }: {
  subgroup: SubgroupDef;
  renderField: (f: FieldDef, display?: "active" | "review") => React.ReactNode;
  state: ModuleState;
  isNA: boolean;
  onToggleNA: (na: boolean) => void;
  isDone?: boolean;
  onToggleDone?: (done: boolean) => void;
  forceOpen?: boolean;
  note?: string;
  onNote?: (n: string) => void;
}) {
  const effective = computeSubgroupStatus(subgroup, state);
  const { filled, total } = subgroupProgress(subgroup, state);
  const visibleFields = subgroup.fields.filter((f) => shouldShowField(f, state.values));
  const completedFields = visibleFields.filter((f) => (state.fieldStatus[f.id] || "nao_iniciado") === "concluido" && !(state.nonApplicable ?? {})[f.id]);
  const naFields = visibleFields.filter((f) => !!(state.nonApplicable ?? {})[f.id]);
  const [openInternal, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  // Quando marca como concluído manualmente, recolhe.
  useEffect(() => {
    if (isDone) setOpen(false);
  }, [isDone]);
  const open = forceOpen ? true : openInternal;

  if (isNA) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{subgroup.title}</div>
          <div className="text-xs text-muted-foreground">Não se aplica</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onToggleNA(false)}>Reabrir</Button>
      </div>
    );
  }

  const done = !!isDone || effective === "concluido";

  return (
    <div
      className="rounded-md border"
      style={{ borderColor: done ? `color-mix(in oklab, var(--status-done) 50%, var(--border))` : `var(--border)` }}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex-1 flex items-center justify-between gap-2 p-3 hover:bg-secondary/40 text-left"
        >
          <div className="min-w-0 flex items-center gap-2">
            {done ? (
              <Check className="h-4 w-4 shrink-0" style={{ color: "var(--status-done)" }} />
            ) : (
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `var(--status-${statusVarSuffix(effective)})` }} />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold">{subgroup.title}</div>
              {subgroup.description && <div className="text-xs text-muted-foreground line-clamp-1">{subgroup.description}</div>}
            </div>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">
            {filled}/{total}
          </div>
        </button>
        {(completedFields.length > 0 || naFields.length > 0) && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="px-2 text-xs hover:bg-secondary/40 border-l border-border inline-flex items-center gap-1"
                title="Ver campos recolhidos"
              >
                {completedFields.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] text-white" style={{ backgroundColor: "var(--status-done)" }}>
                    {completedFields.length}
                  </span>
                )}
                {naFields.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-dashed border-border px-1 text-[10px] text-muted-foreground">
                    {naFields.length} N/A
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-2">
              <div className="px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">Campos recolhidos</div>
              <div className="grid max-h-80 gap-2 overflow-y-auto p-1">
                {completedFields.map((f) => renderField(f, "review"))}
                {naFields.map((f) => renderField(f, "review"))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {onToggleDone && (
          isDone ? (
            <button
              type="button"
              className="px-2 text-xs hover:bg-secondary/40 border-l border-border inline-flex items-center gap-1"
              style={{ color: "var(--status-done)" }}
              title="Reabrir subgrupo"
              onClick={() => onToggleDone(false)}
            >
              <Unlock className="h-3.5 w-3.5" />
            </button>
          ) : effective === "concluido" ? null : (
            <button
              type="button"
              className="px-2 text-xs hover:bg-secondary/40 border-l border-border inline-flex items-center gap-1"
              style={{ color: "var(--status-done)" }}
              title="Concluir subgrupo"
              onClick={() => onToggleDone(true)}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )
        )}
        <button
          type="button"
          className="px-2 text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-l border-border"
          title="Marcar subgrupo como não se aplica"
          onClick={() => onToggleNA(true)}
        >
          <Ban className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="border-t border-border p-3 grid gap-2.5">
          {visibleFields.map((f) => renderField(f))}
          {onNote && (
            <div className="pt-1">
              {!noteOpen && !note && (
                <button type="button" onClick={() => setNoteOpen(true)}
                  className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <MessageSquarePlus className="h-3 w-3" /> Adicionar observação
                </button>
              )}
              {(noteOpen || note) && (
                <Textarea rows={2} className="text-xs" placeholder="Observação deste subgrupo…"
                  value={note ?? ""} onChange={(e) => onNote(e.target.value)} onBlur={() => !note && setNoteOpen(false)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================== Documentos ============================

function DocumentsPanel({ survey }: { survey: any }) {
  const docState = survey.modules.documentos;
  const allAttachments: Array<{ moduleId: string; moduleTitle: string; att: any }> = [];
  const allModules = useEffectiveModulesForSurvey(survey);
  const docModule = allModules.find((m) => m.id === "documentos");
  for (const m of allModules) {
    const st = survey.modules[m.id];
    if (!st) continue;
    for (const att of st.attachments) {
      allAttachments.push({ moduleId: m.id, moduleTitle: m.title, att });
    }
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        addAttachment(survey.id, "documentos", {
          id: Math.random().toString(36).slice(2, 11),
          name: f.name, type: f.type, dataUrl: reader.result as string,
          createdAt: new Date().toISOString(), moduleTag: "documentos",
        });
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Files className="h-5 w-5" /> Documentos e Anexos</h2>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFile} accept="image/*,application/pdf,audio/*" />
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-secondary"><Plus className="h-4 w-4" /> Adicionar arquivo</span>
            </label>
          </div>
          {allAttachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento anexado neste levantamento.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allAttachments.map(({ moduleId, moduleTitle, att }) => (
                <div key={att.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                  {att.type.startsWith("image/") ? (
                    <img src={att.dataUrl} alt={att.name} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded bg-secondary"><FileText className="h-5 w-5 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{att.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{moduleTitle}</div>
                    <a href={att.dataUrl} download={att.name} className="text-xs text-primary">Baixar</a>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeAttachment(survey.id, moduleId, att.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subgrupos e campos próprios do módulo documentos */}
      {docState && docModule && <ModulePanel survey={survey} module={docModule} />}
    </div>
  );
}

// =========================== Pendências ============================

function PendenciasPanel({ survey }: { survey: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ module: "", description: "", responsible: "" });
  const allModules = useEffectiveModulesForSurvey(survey);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--status-pending)]" /> Pendências do levantamento
          </h2>
          <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}><Plus className="h-4 w-4 mr-1" /> Nova pendência</Button>
        </div>
        {open && (
          <div className="grid gap-2 mb-3 rounded-md border border-border p-3">
            <Select value={form.module} onValueChange={(v) => setForm({ ...form, module: v })}>
              <SelectTrigger><SelectValue placeholder="Módulo de origem" /></SelectTrigger>
              <SelectContent>
                {allModules.map((m) => <SelectItem key={m.id} value={m.title}>{m.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea rows={2} placeholder="Descrição da pendência" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input placeholder="Responsável" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setForm({ module: "", description: "", responsible: "" }); }}>Cancelar</Button>
              <Button size="sm" onClick={() => {
                if (!form.description.trim()) return;
                addPendencia(survey.id, { module: form.module || "Geral", description: form.description, responsible: form.responsible, status: "pendente" });
                setForm({ module: "", description: "", responsible: "" }); setOpen(false);
              }}>Adicionar</Button>
            </div>
          </div>
        )}
        {survey.pendencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem pendências.</p>
        ) : (
          <div className="grid gap-2">
            {survey.pendencias.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.description}</div>
                  <div className="text-xs text-muted-foreground">{p.module}{p.responsible && ` • ${p.responsible}`}</div>
                </div>
                <StatusBadge status={p.status} />
                <Button variant="ghost" size="sm" onClick={() => removePendencia(survey.id, p.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =========================== Encerramento ============================

function EncerramentoPanel({ survey }: { survey: any }) {
  const validacao = survey.modules.validacao;
  const allModules = useEffectiveModulesForSurvey(survey);
  const enabledIds: string[] = survey.enabledModules ?? allModules.map((m) => m.id);
  const enabledModules = allModules.filter((m) => enabledIds.includes(m.id) && !CENTRAL_TAB_MODULES.has(m.id));

  const withStatus = enabledModules.map((m) => ({ m, st: computeModuleStatus(m, survey.modules[m.id] as ModuleState) }));
  const concluidos = withStatus.filter(({ st }) => st === "concluido").map(({ m }) => m);
  const naMods = withStatus.filter(({ st }) => st === "nao_se_aplica").map(({ m }) => m);
  const emAndamento = withStatus.filter(({ st }) => st === "em_andamento" || st === "nao_iniciado").map(({ m }) => m);
  const pendAbertas = survey.pendencias.filter((p: any) => p.status !== "concluido");
  const pendResolvidas = survey.pendencias.filter((p: any) => p.status === "concluido");

  const ident = survey.modules.identificacao?.values ?? {};
  const dataVisita: string = ident.data_visita ?? "";
  const horaChegada: string = ident.hora_chegada ?? "";
  const [horaSaida, setHoraSaida] = useState<string>(survey.closedAtSaida ?? "");

  const closed = !!survey.closedAt;
  const blockers = emAndamento.length + pendAbertas.length;
  const noPurposes = !survey.purposes || survey.purposes.length === 0;

  // Cronômetro ao vivo até registrar saída
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (horaSaida) return;
    const t = window.setInterval(() => setTick((v) => v + 1), 1000);
    return () => window.clearInterval(t);
  }, [horaSaida]);
  const duration = useMemo(
    () => computeDuration(dataVisita, horaChegada, horaSaida || nowHHMMSS()),
    [dataVisita, horaChegada, horaSaida, tick],
  );

  function registrarSaida() {
    const hh = nowHHMM();
    setHoraSaida(hh);
    setFieldValue(survey.id, "validacao", "hora_saida", hh);
  }

  return (
    <div className="space-y-4">
      {closed && (
        <Card style={statusOutlineStyle("done")}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4" style={{ color: "var(--status-done)" }} />
              Levantamento encerrado em {new Date(survey.closedAt).toLocaleString()}.
            </div>
            <Button variant="outline" size="sm" onClick={() => reopenSurvey(survey.id)}>
              <Unlock className="h-4 w-4 mr-1" /> Reabrir
            </Button>
          </CardContent>
        </Card>
      )}

      <FinalidadeCard surveyId={survey.id} purposes={survey.purposes} readOnly={closed} />

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Duração da visita</h3>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <Label className="text-xs">Data</Label>
              <div className="text-sm">{dataVisita || <span className="text-muted-foreground">não informada</span>}</div>
            </div>
            <div>
              <Label className="text-xs">Chegada</Label>
              <div className="text-sm">{horaChegada || <span className="text-muted-foreground">—</span>}</div>
            </div>
            <div>
              <Label className="text-xs">Saída</Label>
              <div className="text-sm">{horaSaida || <span className="text-muted-foreground">— ainda na visita</span>}</div>
            </div>
          </div>
          <div className="rounded-md border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/50">
            <div>
              <div className="text-xs text-muted-foreground">Tempo {horaSaida ? "total" : "decorrido"}</div>
              <div className="text-2xl font-mono font-semibold tabular-nums">{duration ?? "—"}</div>
            </div>
            {!horaSaida ? (
              <Button size="lg" onClick={registrarSaida} disabled={closed}
                style={{ backgroundColor: "var(--status-done)", color: "white" }}>
                <Lock className="h-4 w-4 mr-2" /> Registrar saída
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setHoraSaida(""); setFieldValue(survey.id, "validacao", "hora_saida", ""); }} disabled={closed}>
                Editar saída
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <PhotoAttachmentsPanel survey={survey} readOnly={closed} />

      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Signature className="h-5 w-5" /> Validação e Encerramento</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div><Label>Assinatura cliente</Label><Input disabled={closed} value={validacao?.values.assinatura_cliente ?? ""} onChange={(e) => setFieldValue(survey.id, "validacao", "assinatura_cliente", e.target.value)} placeholder="Nome de quem assinou" /></div>
            <div>
              <Label>Técnico responsável</Label>
              <Input disabled value={(survey.modules.pessoas?.values.tecnicos as Array<{ nome?: string }> | undefined)?.map((p) => p?.nome).filter(Boolean).join(", ") || "—"} />
              <p className="text-xs text-muted-foreground mt-1">Preenchido a partir de Pessoas Envolvidas.</p>
            </div>
            <div>
              <Label>Data</Label>
              <Input disabled value={survey.date ?? ""} />
              <p className="text-xs text-muted-foreground mt-1">Data da visita.</p>
            </div>
          </div>
          {blockers > 0 && !closed && (
            <div className="mb-3 text-xs text-muted-foreground">
              Atenção: ainda há {emAndamento.length} módulo(s) sem conclusão e {pendAbertas.length} pendência(s) aberta(s). Você pode encerrar mesmo assim.
            </div>
          )}
          {!closed && noPurposes && (
            <div className="mb-3 rounded-md border border-warn/40 bg-warn-soft p-2 text-xs text-warn-foreground">
              Selecione ao menos uma finalidade nesta etapa para liberar o encerramento.
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {!closed ? (
              <Button
                disabled={noPurposes}
                onClick={() => { closeSurveyWithAutoNA(survey.id, horaSaida || nowHHMM()); updateModule(survey.id, "validacao", { status: "concluido" }); }}
                title={noPurposes ? "Selecione ao menos uma finalidade para encerrar" : "Encerrar levantamento"}
              >
                <Lock className="h-4 w-4 mr-1" /> Encerrar levantamento
              </Button>
            ) : (
              <Button variant="outline" onClick={() => reopenSurvey(survey.id)}>
                <Unlock className="h-4 w-4 mr-1" /> Reabrir
              </Button>
            )}
            <Link to="/levantamentos/$id/resumo" params={{ id: survey.id }}>
              <Button variant="outline"><FileDown className="h-4 w-4 mr-1" /> Ver resumo final</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Resumo dos módulos</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <SummaryRow label="Concluídos" items={concluidos.map((m) => m.title)} tone="done" />
            <SummaryRow label="Em andamento" items={emAndamento.map((m) => m.title)} tone="progress" />
            <SummaryRow label="Não se aplica" items={naMods.map((m) => m.title)} tone="na" />
            <SummaryRow label="Pendências abertas" items={pendAbertas.map((p: any) => `${p.module}: ${p.description}`)} tone="pending" />
          </div>
          {pendResolvidas.length > 0 && (
            <div className="mt-3 text-sm">
              <SummaryRow label="Pendências resolvidas" items={pendResolvidas.map((p: any) => `${p.module}: ${p.description}`)} tone="done" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nowHHMMSS() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function computeDuration(date: string, start: string, end: string): string | null {
  if (!date || !start || !end) return null;
  const s = new Date(`${date}T${start}`);
  const e = new Date(`${date}T${end}`);
  let diff = e.getTime() - s.getTime();
  if (Number.isNaN(diff)) return null;
  if (diff < 0) diff += 24 * 60 * 60 * 1000; // virou o dia
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s2 = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}`;
}

function SummaryRow({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label} ({items.length})</div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">—</div>
      ) : (
        <ul className="text-xs space-y-0.5 list-disc list-inside">
          {items.slice(0, 8).map((s, i) => <li key={i} className="truncate">{s}</li>)}
          {items.length > 8 && <li className="text-muted-foreground">+ {items.length - 8} mais…</li>}
        </ul>
      )}
    </div>
  );
}
