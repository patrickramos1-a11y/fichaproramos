import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { VisaoConsolidada } from "@/components/survey/VisaoConsolidada";
import { useDBSelector, useEffectiveModulesForSurvey, useSurveyTypeMeta, reopenSurvey } from "@/lib/store";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
import { ArrowLeft, ClipboardList, ExternalLink, Files, AlertTriangle, RotateCcw } from "lucide-react";
import type { Attachment, Pendencia } from "@/lib/types";

const RelatorioDetalhado = lazy(() =>
  import("@/components/survey/RelatorioDetalhado").then((m) => ({ default: m.RelatorioDetalhado })),
);

export const Route = createFileRoute("/clientes/$id/levantamentos/$surveyId")({
  component: ClientSurveyDetailPage,
});

function ClientSurveyDetailPage() {
  const { id, surveyId } = Route.useParams();
  const data = useDBSelector(
    (state) => {
      const survey = state.surveys.find((entry) => entry.id === surveyId) ?? null;
      const client = survey ? getSurveyClient(survey, state.clients, state.projects) ?? state.clients.find((entry) => entry.id === id) ?? null : state.clients.find((entry) => entry.id === id) ?? null;
      const project = survey ? getSurveyProject(survey, state.projects) ?? null : null;
      return { survey, client, project };
    },
    (a, b) => a.survey === b.survey && a.client === b.client && a.project === b.project,
  );
  const { survey, client, project } = data;
  const modules = useEffectiveModulesForSurvey(survey ?? ({ type: "geral" } as any));
  const typeMeta = useSurveyTypeMeta(survey?.type ?? "geral", survey?.customTypeId);
  const [tab, setTab] = useState("consolidada");

  const docs = useMemo(() => {
    if (!survey) return [] as Array<{ moduleId: string; moduleTitle: string; attachment: Attachment }>;
    return Object.entries(survey.modules ?? {}).flatMap(([moduleId, state]) => {
      const moduleTitle = modules.find((mod) => mod.id === moduleId)?.title ?? moduleId;
      return (state.attachments ?? []).map((attachment) => ({ moduleId, moduleTitle, attachment }));
    }).sort((a, b) => String(b.attachment.createdAt).localeCompare(String(a.attachment.createdAt)));
  }, [survey, modules]);

  const pendencias = useMemo(() => {
    if (!survey) return [] as Pendencia[];
    return [...(survey.pendencias ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [survey]);

  if (!survey || !client) {
    return (
      <AppShell>
        <Link to="/clientes/$id" params={{ id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao cliente
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Levantamento não encontrado para este cliente.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/clientes/$id" params={{ id: client.id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Cliente
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            {client.name}{project?.name ? ` · ${project.name}` : ""} · {typeMeta.label}
          </div>
          <h1 className="mt-1 break-words text-2xl font-semibold">{survey.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={survey.closedAt ? "concluido" : "em_andamento"} />
            <Badge variant="outline">{survey.date ? new Date(survey.date).toLocaleDateString("pt-BR") : "Sem data"}</Badge>
            {docs.length > 0 && <Badge variant="secondary">{docs.length} documento(s)/foto(s)</Badge>}
            {pendencias.length > 0 && <Badge variant="secondary">{pendencias.length} pendência(s)</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {survey.closedAt && (
            <Button variant="outline" onClick={() => reopenSurvey(survey.id)}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reabrir
            </Button>
          )}
          <Link to="/levantamentos/$id" params={{ id: survey.id }} search={{ mode: "edit" }}>
            <Button>
              <ClipboardList className="mr-1 h-4 w-4" /> Abrir preenchimento
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          <TabsTrigger value="consolidada">Visão Consolidada</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório Detalhado</TabsTrigger>
          <TabsTrigger value="documentos">Fotos & Documentos</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
          <TabsTrigger value="exportacao">Exportação</TabsTrigger>
        </TabsList>

        <TabsContent value="consolidada">
          <VisaoConsolidada
            surveyId={survey.id}
            onOpenEditor={(moduleId) => {
              const suffix = moduleId ? `?modulo=${encodeURIComponent(moduleId)}` : "";
              window.location.href = `/levantamentos/${survey.id}${suffix}`;
            }}
          />
        </TabsContent>

        <TabsContent value="relatorio">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando relatório...</p>}>
            <RelatorioDetalhado
              surveyId={survey.id}
              onOpenEditor={(moduleId) => {
                const suffix = moduleId ? `?modulo=${encodeURIComponent(moduleId)}` : "";
                window.location.href = `/levantamentos/${survey.id}${suffix}`;
              }}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentsView docs={docs} />
        </TabsContent>

        <TabsContent value="pendencias">
          <PendenciasView pendencias={pendencias} />
        </TabsContent>

        <TabsContent value="exportacao">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <ExternalLink className="h-4 w-4" /> Exportação e uso externo
              </div>
              <p className="text-sm text-muted-foreground">
                Use a aba Relatório Detalhado para copiar texto, gerar bloco para IA, baixar Markdown, TXT ou JSON e imprimir em PDF.
              </p>
              <Button variant="outline" onClick={() => setTab("relatorio")}>Abrir relatório detalhado</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function DocumentsView({ docs }: { docs: Array<{ moduleId: string; moduleTitle: string; attachment: Attachment }> }) {
  if (docs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum documento ou foto vinculado a este levantamento.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {docs.map(({ attachment, moduleTitle }) => (
        <Card key={attachment.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <Files className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="break-words">{attachment.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {moduleTitle} · {attachment.type || "arquivo"} · {attachment.createdAt ? new Date(attachment.createdAt).toLocaleDateString("pt-BR") : "sem data"}
              </div>
            </div>
            {attachment.dataUrl && (
              <a href={attachment.dataUrl} download={attachment.name} className="text-sm text-primary hover:underline">
                Baixar
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PendenciasView({ pendencias }: { pendencias: Pendencia[] }) {
  if (pendencias.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma pendência registrada neste levantamento.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {pendencias.map((pendencia) => (
        <Card key={pendencia.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="break-words">{pendencia.description}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {pendencia.module} · {pendencia.responsible || "sem responsável"} · {pendencia.createdAt ? new Date(pendencia.createdAt).toLocaleDateString("pt-BR") : "sem data"}
              </div>
            </div>
            <StatusBadge status={pendencia.status} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
