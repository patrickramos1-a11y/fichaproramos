import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { useDBSelector, useEffectiveModulesForSurvey, useSurveyTypeMeta, closeSurveyWithAutoNA, reopenSurvey, removePendencia } from "@/lib/store";
import { buildOverview, buildNarrative, type ModuleSummary } from "@/lib/surveyNarrative";
import { SURVEY_PURPOSE_LABELS } from "@/lib/types";
import {
  AlertTriangle, Camera, CheckCircle2, ClipboardList, FileText, Lock, Pencil,
  Unlock, Image as ImageIcon, Mic, ListChecks,
} from "lucide-react";
import { QuickEditDrawer, type QuickEditTarget } from "./QuickEditDrawer";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
import { statusOutlineStyle } from "@/lib/colors";
import { attachmentSrc } from "@/lib/attachments";

export function VisaoConsolidada({ surveyId, onOpenEditor }: { surveyId: string; onOpenEditor: (moduleId?: string) => void }) {
  const data = useDBSelector(
    (s) => {
      const survey = s.surveys.find((x) => x.id === surveyId) ?? null;
      const project = survey ? getSurveyProject(survey, s.projects) ?? null : null;
      const client = survey ? getSurveyClient(survey, s.clients, s.projects) ?? null : null;
      return { survey, project, client };
    },
    (a, b) => a.survey === b.survey && a.client === b.client && a.project === b.project,
  );
  const { survey, client, project } = data;
  const modules = useEffectiveModulesForSurvey(survey ?? ({ type: "geral" } as any));
  const typeMeta = useSurveyTypeMeta(survey?.type ?? "geral", survey?.customTypeId);

  const [editTarget, setEditTarget] = useState<QuickEditTarget | null>(null);

  const overview = useMemo(() => survey ? buildOverview(survey, modules) : null, [survey, modules]);
  const narrative = useMemo(
    () => (survey && overview ? buildNarrative(survey, overview, client, typeMeta.label) : ""),
    [survey, overview, client, typeMeta.label],
  );

  if (!survey || !overview) return null;

  const closed = !!survey.closedAt;
  const purposes = (survey.purposes ?? []).map((p) => SURVEY_PURPOSE_LABELS[p]).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Cabeçalho rico */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{client?.name ?? "Cliente"} · {project?.name ?? ""}</div>
              <h2 className="text-xl font-semibold flex items-center gap-2 truncate">
                {survey.title}
                {closed ? (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--status-done)", color: "var(--status-done)" }}>
                    <Lock className="h-3 w-3" /> Encerrado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: "var(--status-progress)", color: "var(--status-progress)" }}>
                    Em andamento
                  </span>
                )}
              </h2>
              <div className="text-xs text-muted-foreground mt-1">{typeMeta.label}</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {survey.date && <div>Data: <strong className="text-foreground">{survey.date}</strong></div>}
              {survey.responsavel && <div>Responsável: <strong className="text-foreground">{survey.responsavel}</strong></div>}
              {survey.realizadoPor && <div>Realizado por: <strong className="text-foreground">{survey.realizadoPor}</strong></div>}
            </div>
          </div>

          {purposes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {purposes.map((p) => (
                <span key={p} className="rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5 font-medium">{p}</span>
              ))}
            </div>
          )}

          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso geral</span>
            <span><strong className="text-foreground">{overview.filledFields}</strong>/{overview.totalFields} campos</span>
          </div>
          <Progress value={Math.round(overview.progress * 100)} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <Kpi label="Módulos OK" value={overview.modulesDone} tone="done" icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
            <Kpi label="Pendências" value={overview.openPendencias} tone="pending" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <Kpi label="Documentos" value={overview.docCount} tone="doc" icon={<FileText className="h-3.5 w-3.5" />} />
            <Kpi label="Fotos" value={overview.photoCount} tone="progress" icon={<Camera className="h-3.5 w-3.5" />} />
          </div>
        </CardContent>
      </Card>

      {/* Narrativa */}
      <Card>
        <CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Resumo técnico</div>
          <p className="text-sm leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* Cards de situação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <SituationCard label="Concluídos" value={overview.modulesDone} tone="done" />
        <SituationCard label="Em andamento" value={overview.modulesInProgress} tone="progress" />
        <SituationCard label="A iniciar" value={overview.modulesNotStarted} tone="todo" />
        <SituationCard label="N/A" value={overview.modulesNa} tone="na" />
        <SituationCard label="Anexos" value={overview.totalAttachments} tone="doc" />
        <SituationCard label="Pendências" value={overview.openPendencias} tone="pending" />
      </div>

      {/* Blocos por módulo */}
      <div className="grid gap-3">
        {overview.modules
          .filter((s) => s.module.id !== "documentos" && s.module.id !== "validacao")
          // Omite módulos N/A e módulos sem nenhum dado relevante
          .filter((s) => {
            if (s.state?.naModule) return false;
            const hasFilled = s.filled > 0;
            const hasAtts = (s.state?.attachments?.length ?? 0) > 0;
            const hasNotes = !!s.state?.notes;
            return hasFilled || hasAtts || hasNotes;
          })
          .map((s) => (
            <ModuleConsolidatedCard
              key={s.module.id}
              summary={s}
              onEditModule={() => onOpenEditor(s.module.id)}
              onEditSubgroup={(sgId) => setEditTarget({ kind: "subgroup", surveyId: survey.id, moduleId: s.module.id, subgroupId: sgId })}
              onEditField={(fid) => setEditTarget({ kind: "field", surveyId: survey.id, moduleId: s.module.id, fieldId: fid })}
            />
          ))}
      </div>

      {/* Pendências */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[var(--status-pending)]" /> Pendências
            </h3>
            <span className="text-xs text-muted-foreground">{survey.pendencias.length} registrada(s)</span>
          </div>
          {survey.pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há pendências registradas neste levantamento.</p>
          ) : (
            <ul className="grid gap-2">
              {survey.pendencias.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0">
                    <div className="text-sm truncate">{p.description}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.module}{p.responsible ? ` · ${p.responsible}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge status={p.status} />
                    <Button variant="ghost" size="sm" onClick={() => removePendencia(survey.id, p.id)} disabled={closed}>Resolver</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Anexos resumidos */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Fotos e documentos
            </h3>
            <span className="text-xs text-muted-foreground">
              {overview.photoCount} fotos · {overview.docCount} docs · {overview.audioCount} áudios
            </span>
          </div>
          {overview.totalAttachments === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anexo registrado ainda.</p>
          ) : (
            <AttachmentsThumbs overview={overview} />
          )}
        </CardContent>
      </Card>

      {/* Encerramento */}
      <Card style={statusOutlineStyle(closed ? "done" : "progress")}>
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {closed ? (
              <>Encerrado em <strong>{new Date(survey.closedAt!).toLocaleString()}</strong>{survey.closedAtSaida ? ` · saída ${survey.closedAtSaida}` : ""}.</>
            ) : (
              <>Levantamento ainda em andamento. {overview.openPendencias > 0 && `Há ${overview.openPendencias} pendência(s) em aberto.`}</>
            )}
          </div>
          <div className="flex items-center gap-2">
            {closed ? (
              <Button variant="outline" onClick={() => reopenSurvey(survey.id)}>
                <Unlock className="h-4 w-4 mr-1" /> Reabrir
              </Button>
            ) : (
              <Button onClick={() => closeSurveyWithAutoNA(survey.id)} disabled={!survey.purposes || survey.purposes.length === 0}>
                <Lock className="h-4 w-4 mr-1" /> Encerrar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <QuickEditDrawer target={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
    </div>
  );
}

function Kpi({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2.5" style={{ borderColor: `color-mix(in oklab, var(--status-${tone}) 35%, var(--border))`, backgroundColor: `color-mix(in oklab, var(--status-${tone}) 8%, transparent)` }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider" style={{ color: `var(--status-${tone})` }}>
        {icon}{label}
      </div>
      <div className="text-2xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function SituationCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2.5 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold" style={{ color: `var(--status-${tone})` }}>{value}</div>
    </div>
  );
}

function ModuleConsolidatedCard({ summary, onEditModule, onEditSubgroup, onEditField }: {
  summary: ModuleSummary;
  onEditModule: () => void;
  onEditSubgroup: (sgId: string) => void;
  onEditField: (fieldId: string) => void;
}) {
  const { module: m, status, filled, total, subgroups, state } = summary;
  // Apenas subgrupos com algo preenchido
  const visibleSubgroups = subgroups.filter((s) => s.filled > 0);
  const pct = total ? Math.round((filled / total) * 100) : 0;

  const summaryText = (() => {
    if (status === "concluido") return `Módulo concluído com ${filled} campo(s) preenchido(s).`;
    if (total === 0) return "Sem campos exigíveis neste módulo.";
    if (filled === 0) return `Módulo ainda não iniciado — ${total} campo(s) a preencher.`;
    return `${filled} de ${total} campos preenchidos.`;
  })();

  return (
    <Card style={statusOutlineStyle(statusVar(status))}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{m.title}</h3>
              <StatusBadge status={status} />
            </div>
            {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{filled}/{total}</span>
            <Button variant="ghost" size="sm" onClick={onEditModule} title="Abrir no editor de módulos">
              <ListChecks className="h-3.5 w-3.5 mr-1" /> Editor
            </Button>
          </div>
        </div>

        <p className="text-sm leading-relaxed">{summaryText}</p>

        {state?.notes && (
          <p className="text-xs italic text-muted-foreground mt-2">"{state.notes}"</p>
        )}

        {visibleSubgroups.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {visibleSubgroups.map((s) => (
              <div key={s.sg.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2.5 py-1.5">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: `var(--status-${statusVar(s.status)})` }} />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{s.sg.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-muted-foreground">{s.filled}/{s.total}</span>
                  <Button variant="ghost" size="sm" onClick={() => onEditSubgroup(s.sg.id)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {pct > 0 && pct < 100 && (
          <Progress value={pct} className="mt-3 h-1" />
        )}
      </CardContent>
    </Card>
  );
}

function statusVar(s: string): string {
  switch (s) {
    case "concluido": return "done";
    case "em_andamento": return "progress";
    case "pendente": case "aguardando_documento": case "aguardando_empresa": case "requer_retorno": return "pending";
    case "nao_se_aplica": return "na";
    default: return "todo";
  }
}

function AttachmentsThumbs({ overview }: { overview: ReturnType<typeof buildOverview> }) {
  const all = overview.modules.flatMap((m) =>
    (m.state?.attachments ?? []).map((a) => ({ a, moduleTitle: m.module.title })),
  );
  const photos = all.filter((x) => x.a.type?.startsWith("image/")).slice(0, 8);
  const docs = all.filter((x) => !x.a.type?.startsWith("image/") && !x.a.type?.startsWith("audio/")).slice(0, 6);
  const audios = all.filter((x) => x.a.type?.startsWith("audio/")).slice(0, 4);

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Fotos recentes</div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
            {photos.map(({ a, moduleTitle }) => (
              <div key={a.id} className="aspect-square rounded-md overflow-hidden border border-border" title={`${a.name} · ${moduleTitle}`}>
                <img src={attachmentSrc(a)} alt={a.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
      {docs.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Documentos</div>
          <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
            {docs.map(({ a, moduleTitle }) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{a.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto truncate">{moduleTitle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {audios.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Áudios</div>
          <ul className="grid gap-1.5 text-xs">
            {audios.map(({ a }) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{a.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
