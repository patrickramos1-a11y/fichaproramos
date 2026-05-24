import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { bulkDeleteSurveys, getSurveyTypeMeta, useDB } from "@/lib/store";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
import { ALL_SURVEY_PURPOSES, SURVEY_PURPOSE_LABELS, type SurveyPurpose } from "@/lib/types";
import { PurposeChips } from "@/components/FinalidadeCard";
import { statusOutlineStyle } from "@/lib/colors";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClipboardList, Filter, Lock, Plus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/levantamentos/")({
  head: () => ({ meta: [{ title: "Levantamentos - Ramos Engenharia" }] }),
  component: ListPage,
});

function ListPage() {
  const db = useDB();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<Set<SurveyPurpose>>(new Set());
  const [showClosed, setShowClosed] = useState(true);

  const projectIndex = useMemo(() => new Map(db.projects.map((project) => [project.id, project])), [db.projects]);
  const clientIndex = useMemo(() => new Map(db.clients.map((client) => [client.id, client])), [db.clients]);

  const deferredPurposes = useDeferredValue(purposeFilter);
  const deferredShowClosed = useDeferredValue(showClosed);

  const filtered = useMemo(() => {
    return db.surveys.filter((survey) => {
      if (!deferredShowClosed && survey.closedAt) return false;
      if (deferredPurposes.size > 0 && !(survey.purposes ?? []).some((purpose) => deferredPurposes.has(purpose))) return false;
      return true;
    });
  }, [db.surveys, deferredPurposes, deferredShowClosed]);

  const open = filtered.filter((survey) => !survey.closedAt);
  const closed = filtered.filter((survey) => survey.closedAt);

  function togglePurpose(purpose: SurveyPurpose) {
    const next = new Set(purposeFilter);
    if (next.has(purpose)) next.delete(purpose);
    else next.add(purpose);
    setPurposeFilter(next);
  }

  function toggleSel(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <AppShell>
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Levantamentos</h1>
          <p className="text-sm text-muted-foreground">{db.surveys.length} no total</p>
        </div>
        <Link to="/levantamentos/novo" search={{ clientId: undefined }} className="shrink-0">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Novo
          </Button>
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Filter className="h-3 w-3" /> Filtrar:
        </span>
        {ALL_SURVEY_PURPOSES.map((purpose) => {
          const active = purposeFilter.has(purpose);
          return (
            <button
              key={purpose}
              onClick={() => togglePurpose(purpose)}
              className={`rounded-full border px-2 py-0.5 text-[11px] whitespace-normal text-left transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
              }`}
            >
              {SURVEY_PURPOSE_LABELS[purpose]}
            </button>
          );
        })}
        <button
          onClick={() => setShowClosed((value) => !value)}
          className={`rounded-full border px-2 py-0.5 text-[11px] whitespace-normal text-left transition-colors ${
            showClosed ? "border-border" : "border-primary text-primary"
          }`}
        >
          {showClosed ? "Ocultar concluidos" : "Mostrar concluidos"}
        </button>
        {(purposeFilter.size > 0 || !showClosed) && (
          <button
            onClick={() => {
              setPurposeFilter(new Set());
              setShowClosed(true);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">Nenhum levantamento encontrado.</CardContent>
        </Card>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-semibold">
                Em andamento <span className="font-normal text-muted-foreground">- {open.length}</span>
              </h2>
              <div className="mb-5 grid gap-2">
                {open.map((survey) => (
                  <Row
                    key={survey.id}
                    s={survey}
                    projectIndex={projectIndex}
                    clientIndex={clientIndex}
                    sel={selected.has(survey.id)}
                    onSel={() => toggleSel(survey.id)}
                  />
                ))}
              </div>
            </>
          )}
          {closed.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-semibold">
                Concluidos <span className="font-normal text-muted-foreground">- {closed.length}</span>
              </h2>
              <div className="grid gap-2">
                {closed.map((survey) => (
                  <Row
                    key={survey.id}
                    s={survey}
                    projectIndex={projectIndex}
                    clientIndex={clientIndex}
                    sel={selected.has(survey.id)}
                    onSel={() => toggleSel(survey.id)}
                    compact
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-2 shadow-lg">
          <span className="whitespace-nowrap text-xs font-medium">{selected.size} sel.</span>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="sm" className="h-8 px-2.5" onClick={() => setConfirm(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Excluir
          </Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} levantamento(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta acao nao podera ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteSurveys(Array.from(selected));
                setSelected(new Set());
                setConfirm(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Row({
  s,
  projectIndex,
  clientIndex,
  sel,
  onSel,
  compact,
}: {
  s: any;
  projectIndex: Map<string, any>;
  clientIndex: Map<string, any>;
  sel: boolean;
  onSel: () => void;
  compact?: boolean;
}) {
  const typeMeta = getSurveyTypeMeta(s.type, s.customTypeId);
  const projects = Array.from(projectIndex.values());
  const clients = Array.from(clientIndex.values());
  const project = getSurveyProject(s, projects);
  const client = getSurveyClient(s, clients, projects);
  const total = Object.keys(s.modules).length || 1;
  const done = Object.values(s.modules).filter((module: any) => module.status === "concluido").length;

  return (
    <Card className="transition-colors hover:border-primary" style={!compact ? statusOutlineStyle("progress") : undefined}>
      <CardContent className={compact ? "p-2.5" : "p-3"}>
        <div className="flex items-start gap-3">
          <Checkbox checked={sel} onCheckedChange={onSel} aria-label="Selecionar" />
          <Link to="/levantamentos/$id" params={{ id: s.id }} search={{ mode: "edit" }} className="flex min-w-0 flex-1 items-start gap-3">
            <div className={`grid place-items-center rounded-md shrink-0 ${compact ? "h-7 w-7 bg-muted" : "h-9 w-9 bg-primary/10 text-primary"}`}>
              {compact ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <ClipboardList className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="break-words text-sm font-medium leading-tight">{s.title}</div>
              <div className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
                {typeMeta.label} - {client?.name ?? "Cliente nao identificado"}
                {project ? ` - ${project.name}` : ""}
              </div>
              <div className="mt-1">
                <PurposeChips purposes={s.purposes} max={compact ? 3 : 5} />
              </div>
            </div>
            <div className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{done}/{total}</div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
