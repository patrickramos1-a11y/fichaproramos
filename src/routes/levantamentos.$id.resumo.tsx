import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { getSurveyTypeMeta, useDB, useDBStatus } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getEffectiveModulesForCustomType, getEffectiveModulesForType } from "@/lib/modules";
import { StatusBadge } from "@/components/StatusBadge";
import { PhotoAttachmentsPanel } from "@/components/PhotoAttachmentsPanel";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/levantamentos/$id/resumo")({
  component: ResumoPage,
});

function fmtVal(v: any): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (typeof v[0] === "object" && v[0] && "nome" in v[0]) {
      return v.map((p: any) => [p.nome, p.cargo].filter(Boolean).join(" — ")).join("; ");
    }
    return v.join(", ");
  }
  if (typeof v === "object") {
    if ("lat" in v) return `lat ${v.lat}, lng ${v.lng}${v.accuracy ? ` (~${Math.round(v.accuracy)}m)` : ""}`;
    if ("preset" in v || "turnos" in v) {
      const parts: string[] = [];
      if (v.preset) parts.push(String(v.preset));
      if (Array.isArray(v.turnos) && v.turnos.length) {
        parts.push(v.turnos.map((t: any) => `${t.label ? t.label + " " : ""}${t.inicio}–${t.fim}`).join(", "));
      }
      if (Array.isArray(v.dias) && v.dias.length) parts.push(v.dias.join("/"));
      if (v.observacao) parts.push(v.observacao);
      return parts.join(" · ") || "—";
    }
    return JSON.stringify(v);
  }
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  return String(v);
}

function ResumoPage() {
  const { id } = Route.useParams();
  const { hydrated } = useDBStatus();
  const db = useDB();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !hydrated) return <AppShell><p>Carregando resumo...</p></AppShell>;
  const survey = db.surveys.find((s) => s.id === id);
  if (!survey) return <AppShell><p>Não encontrado.</p></AppShell>;
  const project = db.projects.find((p) => p.id === survey.projectId);
  const client = project ? db.clients.find((c) => c.id === project.clientId) : null;
  const customType = survey.customTypeId
    ? db.customSurveyTypes.find((type) => type.id === survey.customTypeId)
    : undefined;
  const modules = customType
    ? getEffectiveModulesForCustomType(customType, db.formOverrides)
    : getEffectiveModulesForType(survey.type, db.formOverrides);
  const typeLabel = getSurveyTypeMeta(survey.type, survey.customTypeId).label;

  return (
    <AppShell>
      <Link to="/levantamentos/$id" params={{ id }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar ao preenchimento
      </Link>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{client?.name} / {project?.name}</div>
          <h1 className="text-2xl font-semibold">{survey.title}</h1>
          <div className="text-sm text-muted-foreground">{typeLabel}</div>
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Resumo consolidado do preenchimento
        </div>
      </div>

      <div className="space-y-4 print:space-y-2">
        <PhotoAttachmentsPanel survey={survey} readOnly />

        {modules.map((m) => {
          const st = survey.modules[m.id];
          return (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">{m.title}</h2>
                  <StatusBadge status={st.status} />
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {m.fields.map((f) => (
                    <div key={f.id} className="flex justify-between gap-3 border-b border-border/50 py-1">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="text-right font-medium">{fmtVal(st.values[f.id])}</dd>
                    </div>
                  ))}
                </dl>
                {m.id !== "fotos" && m.subgroups?.length ? (
                  <div className="mt-4 space-y-4">
                    {m.subgroups.map((sg) => (
                      <div key={sg.id} className="rounded-md border border-border/60 p-4">
                        <div className="mb-2">
                          <h3 className="text-sm font-semibold">{sg.title}</h3>
                          {sg.description ? <p className="text-xs text-muted-foreground">{sg.description}</p> : null}
                        </div>
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                          {sg.fields.map((f) => (
                            <div key={f.id} className="flex justify-between gap-3 border-b border-border/50 py-1">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd className="text-right font-medium">{fmtVal(st.values[f.id])}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : null}
                {st.notes && <p className="text-sm mt-3 text-muted-foreground italic">{st.notes}</p>}
                {st.attachments.length > 0 && (
                  <div className="mt-3 grid sm:grid-cols-3 gap-2">
                    {st.attachments.filter((a) => a.type.startsWith("image/")).map((a) => (
                      <img key={a.id} src={a.dataUrl} alt={a.name} className="rounded-md border border-border h-32 w-full object-cover" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">Pendências consolidadas</h2>
          {survey.pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência registrada neste levantamento.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {survey.pendencias.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border/50 py-1">
                  <span><strong>{p.module}:</strong> {p.description} {p.responsible && <em>— {p.responsible}</em>}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>

        {survey.pendencias.length > 0 && (
          <Card><CardContent className="p-5">
            <h2 className="font-semibold mb-3">Resumo de pendências por módulo</h2>
            <ul className="space-y-2 text-sm">
              {Array.from(new Set(survey.pendencias.map((p) => p.module))).map((moduleName) => {
                const count = survey.pendencias.filter((p) => p.module === moduleName).length;
                return <li key={moduleName} className="flex items-center justify-between border-b border-border/50 py-1"><span>{moduleName}</span><span className="font-medium">{count}</span></li>;
              })}
            </ul>
          </CardContent></Card>
        )}

        <Card><CardContent className="p-5">
          <h2 className="font-semibold mb-3">Validação e Encerramento</h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-muted-foreground">Cliente</div><div className="border-t border-border pt-2 mt-8 font-medium">{survey.modules.validacao?.values.assinatura_cliente ?? "—"}</div></div>
              <div><div className="text-muted-foreground">Técnico</div><div className="border-t border-border pt-2 mt-8 font-medium">{(survey.modules.pessoas?.values.tecnicos as Array<{ nome?: string }> | undefined)?.map((p) => p?.nome).filter(Boolean).join(", ") || "—"}</div></div>
              <div><div className="text-muted-foreground">Data</div><div className="border-t border-border pt-2 mt-8 font-medium">{survey.date ?? "—"}</div></div>
          </div>
        </CardContent></Card>
      </div>
    </AppShell>
  );
}