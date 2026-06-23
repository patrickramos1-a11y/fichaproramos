import { Fragment, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDBSelector, useEffectiveModulesForSurvey, useSurveyTypeMeta } from "@/lib/store";
import { buildReport, type SurveyReport, type ReportRow, type ReportModule } from "@/lib/reportBuilder";
import { toMarkdown, toPlainText, toAIPrompt, downloadBlob } from "@/lib/reportFormatters";
import { QuickEditDrawer, type QuickEditTarget } from "./QuickEditDrawer";
import {
  Copy, FileDown, FileText, Code2, Sparkles, Pencil, Printer, AlertTriangle, Image as ImageIcon, Mic,
} from "lucide-react";
import { toast } from "sonner";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
import { statusOutlineStyle } from "@/lib/colors";
import { attachmentSrc } from "@/lib/attachments";

export function RelatorioDetalhado({ surveyId, onOpenEditor }: { surveyId: string; onOpenEditor: (moduleId?: string) => void }) {
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

  const report = useMemo<SurveyReport | null>(() => {
    if (!survey) return null;
    return buildReport(survey, modules, client, typeMeta.label, project?.name);
  }, [survey, modules, client, typeMeta.label, project?.name]);

  if (!survey || !report) return null;

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado para a área de transferência`); }
    catch { toast.error("Não foi possível copiar"); }
  };

  const slug = survey.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "levantamento";

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Exportar:</span>
          <Button size="sm" variant="outline" onClick={() => copy(toMarkdown(report), "Relatório (Markdown)")}>
            <Copy className="h-3.5 w-3.5 mr-1" /> Copiar texto
          </Button>
          <Button size="sm" variant="outline" onClick={() => copy(toAIPrompt(report), "Bloco para IA")}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Copiar para IA
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadBlob(`${slug}.md`, toMarkdown(report), "text/markdown")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Markdown
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadBlob(`${slug}.txt`, toPlainText(report), "text/plain")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> TXT
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadBlob(`${slug}.json`, JSON.stringify(report, null, 2), "application/json")}>
            <Code2 className="h-3.5 w-3.5 mr-1" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir / PDF
          </Button>
        </CardContent>
      </Card>

      {/* Cabeçalho */}
      <Card>
        <CardContent className="p-5">
          <div className="text-xs text-muted-foreground">{report.header.clientName}{report.header.projectName ? ` · ${report.header.projectName}` : ""}</div>
          <h2 className="text-2xl font-semibold mt-0.5">{report.header.title}</h2>
          <div className="text-sm text-muted-foreground">{report.header.typeLabel}</div>
          {report.header.purposes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {report.header.purposes.map((p) => (
                <span key={p} className="rounded-full bg-primary/10 text-primary text-[11px] px-2 py-0.5 font-medium">{p}</span>
              ))}
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Meta label="Status" value={report.header.statusLabel + (report.header.closedAt ? ` (${report.header.closedAt})` : "")} />
            {report.header.date && <Meta label="Data" value={report.header.date} />}
            {report.header.responsavel && <Meta label="Responsável" value={report.header.responsavel} />}
            {report.header.realizadoPor && <Meta label="Realizado por" value={report.header.realizadoPor} />}
            <Meta label="Módulos" value={String(report.header.counters.modules)} />
            <Meta label="Campos" value={`${report.header.counters.filledFields}/${report.header.counters.totalFields}`} />
            <Meta label="Pendências" value={String(report.header.counters.pendencias)} />
            <Meta label="Anexos" value={`${report.header.counters.photos} fotos · ${report.header.counters.docs} docs`} />
          </dl>
        </CardContent>
      </Card>

      {/* Resumo executivo */}
      <Section title="Resumo executivo">
        <p className="text-sm leading-relaxed whitespace-pre-line">{report.executiveSummary}</p>
      </Section>

      {report.purposeSection && (
        <Section title="Finalidades do levantamento">
          <p className="text-sm leading-relaxed">{report.purposeSection}</p>
        </Section>
      )}

      {report.clientSection && (
        <Section title="Dados do cliente">
          <p className="text-sm leading-relaxed mb-3">{report.clientSection.paragraph}</p>
          <ReportTable rows={report.clientSection.rows} />
        </Section>
      )}

      {report.visitSection && (
        <Section title="Contexto da visita" actions={
          <Button variant="ghost" size="sm" onClick={() => onOpenEditor("identificacao")}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
        }>
          <p className="text-sm leading-relaxed mb-3">{report.visitSection.paragraph}</p>
          <ReportTable rows={report.visitSection.rows} onFill={(fid) => setEditTarget({ kind: "field", surveyId: survey.id, moduleId: "identificacao", fieldId: fid })} />
        </Section>
      )}

      {/* Desenvolvimento por módulo */}
      <h3 className="text-sm uppercase tracking-wider text-muted-foreground pt-2">
        {report.profile === "obra_ambiental" ? "Relatório semanal por tópico" : "Desenvolvimento por módulo"}
      </h3>
      {report.modules.map((m) => (
        <ModuleSection
          key={m.id}
          module={m}
          surveyId={survey.id}
          onEditModule={() => onOpenEditor(m.id)}
          onEditSubgroup={(sgId) => setEditTarget({ kind: "subgroup", surveyId: survey.id, moduleId: m.id, subgroupId: sgId })}
          onFill={(fid) => setEditTarget({ kind: "field", surveyId: survey.id, moduleId: m.id, fieldId: fid })}
        />
      ))}

      {/* Pendências */}
      <Section title="Pendências" icon={<AlertTriangle className="h-4 w-4 text-[var(--status-pending)]" />}>
        <p className="text-sm leading-relaxed mb-3">{report.pendencias.paragraph}</p>
        {report.pendencias.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 pr-3">Pendência</th><th className="py-1 pr-3">Módulo</th><th className="py-1 pr-3">Responsável</th><th className="py-1">Status</th></tr>
              </thead>
              <tbody>
                {report.pendencias.items.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-1.5 pr-3">{p.description}</td>
                    <td className="py-1.5 pr-3">{p.module}</td>
                    <td className="py-1.5 pr-3">{p.responsible ?? "—"}</td>
                    <td className="py-1.5">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Anexos */}
      <Section title="Fotos e documentos" icon={<ImageIcon className="h-4 w-4" />}>
        <p className="text-sm text-muted-foreground mb-3">
          {report.attachments.photos.length} fotos · {report.attachments.docs.length} documentos · {report.attachments.audios.length} áudios
        </p>
        {report.attachments.photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-4">
            {report.attachments.photos.slice(0, 18).map((p) => (
              <div key={p.att.id} title={`${p.att.name} · ${p.moduleTitle}`} className="aspect-square rounded-md overflow-hidden border border-border">
                <img src={attachmentSrc(p.att)} alt={p.att.name} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        {report.attachments.docs.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-1.5 text-xs mb-2">
            {report.attachments.docs.map((d) => (
              <li key={d.att.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{d.att.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto truncate">{d.moduleTitle}</span>
              </li>
            ))}
          </ul>
        )}
        {report.attachments.audios.length > 0 && (
          <ul className="grid gap-1.5 text-xs">
            {report.attachments.audios.map((a) => (
              <li key={a.att.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{a.att.name}</span>
                <span className="text-[10px] text-muted-foreground ml-auto truncate">{a.moduleTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Observações */}
      {report.observations.length > 0 && (
        <Section title="Observações técnicas">
          <ul className="grid gap-2 text-sm">
            {report.observations.map((o, i) => (
              <li key={i} className="rounded-md border border-border p-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{o.moduleTitle} · {o.scope}</div>
                <div className="leading-relaxed">{o.text}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Encerramento */}
      <Section title="Encerramento">
        <p className="text-sm leading-relaxed">{report.closing.paragraph}</p>
      </Section>

      <QuickEditDrawer target={editTarget} onOpenChange={(open) => !open && setEditTarget(null)} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children, icon, actions }: { title: string; children: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">{icon}{title}</h3>
          {actions}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ModuleSection({ module: m, surveyId, onEditModule, onEditSubgroup, onFill }: {
  module: ReportModule; surveyId: string;
  onEditModule: () => void;
  onEditSubgroup: (sgId: string) => void;
  onFill: (fieldId: string) => void;
}) {
  const tone = m.status === "Concluído" ? "done" : (m.status === "Em andamento" ? "progress" : (m.status === "Não se aplica" ? "na" : (m.status === "Não iniciado" ? "todo" : "pending")));
  return (
    <Card style={statusOutlineStyle(tone)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h4 className="font-semibold truncate">{m.title}</h4>
            <div className="text-[11px] text-muted-foreground">{m.status} · {m.filled}/{m.total} campos</div>
          </div>
          <Button variant="outline" size="sm" onClick={onEditModule}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar módulo
          </Button>
        </div>
        <p className="text-sm leading-relaxed mb-3">{m.paragraph}</p>

        {m.topRows.length > 0 && (
          <div className="mb-3">
            <ReportTable rows={m.topRows} onFill={onFill} />
          </div>
        )}

        {m.subgroups.map((sg) => (
          <div key={sg.id} className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{sg.title}</div>
                <div className="text-[11px] text-muted-foreground">{sg.status} · {sg.filled}/{sg.total}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEditSubgroup(sg.id)}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            </div>
            {sg.description && <p className="text-xs text-muted-foreground mb-2">{sg.description}</p>}
            <ReportTable rows={sg.rows} onFill={onFill} />
            {sg.note && (
              <p className="text-xs italic text-muted-foreground mt-2 border-l-2 pl-2 border-border">"{sg.note}"</p>
            )}
          </div>
        ))}

        {m.pendencias.length > 0 && (
          <div className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--status-pending)_35%,var(--border))] bg-[color-mix(in_oklab,var(--status-pending)_8%,transparent)] p-3">
            <div className="text-xs font-medium text-[var(--status-pending)] mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Pendências do módulo
            </div>
            <ul className="text-xs grid gap-1">
              {m.pendencias.map((p) => (
                <li key={p.id}>• {p.description}{p.responsible ? ` — ${p.responsible}` : ""}</li>
              ))}
            </ul>
          </div>
        )}

        {m.notes && (
          <p className="text-xs italic text-muted-foreground mt-3 border-l-2 pl-2 border-border">"{m.notes}"</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportTable({ rows, onFill }: { rows: ReportRow[]; onFill?: (fieldId: string) => void }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Sem campos a exibir.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <RowRender key={r.fieldId} row={r} onFill={onFill} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowRender({ row, onFill, indent = 0 }: { row: ReportRow; onFill?: (fieldId: string) => void; indent?: number }) {
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="py-1.5 pr-3 text-muted-foreground w-2/5" style={{ paddingLeft: indent * 12 }}>{row.label}</td>
        <td className="py-1.5 pr-3">
          {row.filled ? (
            <span className="whitespace-pre-wrap">{row.value}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {row.note && <div className="text-[11px] text-muted-foreground italic mt-0.5">"{row.note}"</div>}
        </td>
        <td className="py-1.5 text-right w-32">
          {!row.filled && onFill && (
            <Button variant="ghost" size="sm" onClick={() => onFill(row.fieldId)} className="h-6 text-[11px]">
              Preencher
            </Button>
          )}
        </td>
      </tr>
      {row.subRows?.map((sub, idx) => (
        <Fragment key={`${row.fieldId}-sub-${idx}`}>
          <tr className="bg-secondary/40">
            <td className="py-1 pl-3 pr-3 text-[11px] uppercase tracking-wider text-muted-foreground" colSpan={3} style={{ paddingLeft: (indent + 1) * 12 }}>
              {sub.title}
            </td>
          </tr>
          {sub.rows.map((sr) => (
            <RowRender key={sr.fieldId} row={sr} onFill={onFill} indent={indent + 2} />
          ))}
        </Fragment>
      ))}
    </>
  );
}
