import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { getSurveyTypeMeta, useDB, bulkDeleteSurveys } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, Lock, X, Trash2, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ALL_SURVEY_PURPOSES, SURVEY_PURPOSE_LABELS, type SurveyPurpose } from "@/lib/types";
import { PurposeChips } from "@/components/FinalidadeCard";

export const Route = createFileRoute("/levantamentos/")({
  head: () => ({ meta: [{ title: "Levantamentos — Ramos Engenharia" }] }),
  component: ListPage,
});

function ListPage() {
  const db = useDB();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [purposeFilter, setPurposeFilter] = useState<Set<SurveyPurpose>>(new Set());
  const [showClosed, setShowClosed] = useState(true);

  // Índices pré-calculados (evita N×M find por render)
  const projectIndex = useMemo(
    () => new Map(db.projects.map((p) => [p.id, p])),
    [db.projects],
  );
  const clientIndex = useMemo(
    () => new Map(db.clients.map((c) => [c.id, c])),
    [db.clients],
  );

  const deferredPurposes = useDeferredValue(purposeFilter);
  const deferredShowClosed = useDeferredValue(showClosed);

  const filtered = useMemo(() => {
    return db.surveys.filter((s) => {
      if (!deferredShowClosed && s.closedAt) return false;
      if (deferredPurposes.size && !(s.purposes ?? []).some((p) => deferredPurposes.has(p))) return false;
      return true;
    });
  }, [db.surveys, deferredPurposes, deferredShowClosed]);

  const open = filtered.filter((s) => !s.closedAt);
  const closed = filtered.filter((s) => s.closedAt);

  function togglePurpose(p: SurveyPurpose) {
    const next = new Set(purposeFilter);
    if (next.has(p)) next.delete(p); else next.add(p);
    setPurposeFilter(next);
  }
  function toggleSel(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Levantamentos</h1>
          <p className="text-sm text-muted-foreground">{db.surveys.length} no total</p>
        </div>
        <Link to="/levantamentos/novo" className="shrink-0"><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button></Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Filter className="h-3 w-3" /> Filtrar:
        </span>
        {ALL_SURVEY_PURPOSES.map((p) => {
          const on = purposeFilter.has(p);
          return (
            <button
              key={p}
              onClick={() => togglePurpose(p)}
              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
              }`}
            >
              {SURVEY_PURPOSE_LABELS[p]}
            </button>
          );
        })}
        <button
          onClick={() => setShowClosed((v) => !v)}
          className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
            showClosed ? "border-border" : "border-primary text-primary"
          }`}
        >
          {showClosed ? "Ocultar concluídos" : "Mostrar concluídos"}
        </button>
        {(purposeFilter.size > 0 || !showClosed) && (
          <button
            onClick={() => { setPurposeFilter(new Set()); setShowClosed(true); }}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          Nenhum levantamento encontrado.
        </CardContent></Card>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <h2 className="text-sm font-semibold mb-2">Em andamento <span className="text-muted-foreground font-normal">· {open.length}</span></h2>
              <div className="grid gap-2 mb-5">{open.map((s) => <Row key={s.id} s={s} projectIndex={projectIndex} clientIndex={clientIndex} sel={selected.has(s.id)} onSel={() => toggleSel(s.id)} />)}</div>
            </>
          )}
          {closed.length > 0 && (
            <>
              <h2 className="text-sm font-semibold mb-2">Concluídos <span className="text-muted-foreground font-normal">· {closed.length}</span></h2>
              <div className="grid gap-2">{closed.map((s) => <Row key={s.id} s={s} projectIndex={projectIndex} clientIndex={clientIndex} sel={selected.has(s.id)} onSel={() => toggleSel(s.id)} compact />)}</div>
            </>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1.5 rounded-full border border-border bg-background shadow-lg px-2.5 py-2">
          <span className="text-xs font-medium whitespace-nowrap">{selected.size} sel.</span>
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button>
          <Button variant="destructive" size="sm" className="h-8 px-2.5" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selected.size} levantamento(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { bulkDeleteSurveys(Array.from(selected)); setSelected(new Set()); setConfirm(false); }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Row({ s, projectIndex, clientIndex, sel, onSel, compact }: { s: any; projectIndex: Map<string, any>; clientIndex: Map<string, any>; sel: boolean; onSel: () => void; compact?: boolean }) {
  const t = getSurveyTypeMeta(s.type, s.customTypeId);
  const proj = projectIndex.get(s.projectId);
  const client = proj ? clientIndex.get(proj.clientId) : null;
  const total = Object.keys(s.modules).length || 1;
  const done = Object.values(s.modules).filter((m: any) => m.status === "concluido").length;
  return (
    <Card className={`hover:border-primary transition-colors ${compact ? "" : "border-l-4"}`} style={!compact ? { borderLeftColor: "var(--status-progress)" } : undefined}>
      <CardContent className={`flex items-center gap-3 ${compact ? "p-2.5" : "p-3"}`}>
        <Checkbox checked={sel} onCheckedChange={onSel} aria-label="Selecionar" />
        <Link to="/levantamentos/$id" params={{ id: s.id }} className="flex-1 flex items-center gap-3 min-w-0">
          <div className={`grid place-items-center rounded-md shrink-0 ${compact ? "h-7 w-7 bg-muted" : "h-9 w-9 bg-primary/10 text-primary"}`}>
            {compact ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <ClipboardList className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{s.title}</div>
            <div className="text-[11px] text-muted-foreground truncate">{t.label} · {client?.name ?? "—"}</div>
            <div className="mt-1"><PurposeChips purposes={s.purposes} max={compact ? 3 : 5} /></div>
          </div>
          <div className="text-[11px] text-muted-foreground shrink-0">{done}/{total}</div>
        </Link>
      </CardContent>
    </Card>
  );
}
