import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { getSurveyTypeMeta, useCustomSurveyTypes, useDB, addSurveyExt, deleteSurvey, useDBStatus } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, ClipboardList } from "lucide-react";
import { type SurveyType } from "@/lib/types";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/projetos/$id")({
  component: ProjetoDetail,
});

function ProjetoDetail() {
  const { id } = Route.useParams();
  const { hydrated } = useDBStatus();
  const db = useDB();
  const nav = useNavigate();
  const project = db.projects.find((p) => p.id === id);
  const client = project ? db.clients.find((c) => c.id === project.clientId) : null;
  const empreendimento = project?.empreendimentoId ? db.empreendimentos.find((e) => e.id === project.empreendimentoId) : null;
  const surveys = db.surveys.filter((s) => s.projectId === id);
  const allTypes = useCustomSurveyTypes().filter((c) => !c.archivedAt);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [type, setType] = useState<SurveyType>(allTypes[0]?.id ?? "geral");
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!allTypes.find((entry) => entry.id === type) && allTypes[0]?.id) {
      setType(allTypes[0].id);
    }
  }, [allTypes, type]);

  if (!mounted || !hydrated) return <AppShell><p>Carregando projeto...</p></AppShell>;
  if (!project) return <AppShell><p>Projeto não encontrado.</p></AppShell>;

  function create() {
    const selected = allTypes.find((entry) => entry.id === type);
    if (!selected) return;
    const effectiveType: SurveyType = (selected.sourceTypeId as SurveyType | undefined) ?? selected.id;
    const s = addSurveyExt({
      projectId: id,
      type: effectiveType,
      title: title || selected.label,
      customTypeId: selected.id,
    });
    setOpen(false); setTitle("");
    nav({ to: "/levantamentos/$id", params: { id: s.id } });
  }

  return (
    <AppShell>
      <Link to="/projetos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Projetos
      </Link>
      <Card className="mb-6">
        <CardHeader>
          <div className="text-xs text-muted-foreground">{client?.name}</div>
          <CardTitle>{project.name}</CardTitle>
          {empreendimento && (
            <div className="text-xs text-muted-foreground mt-1">Empreendimento: {empreendimento.name}</div>
          )}
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{project.description || "Sem descrição."}</CardContent>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Levantamentos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button type="button" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo levantamento</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo levantamento</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Tipo</Label>
                <div className="grid gap-2 mt-1">
                  {allTypes.map((t) => (
                    <label key={t.id} className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${type === t.id ? "border-primary bg-primary/5" : "border-border"}`}>
                      <input type="radio" checked={type === t.id} onChange={() => setType(t.id)} />
                      <div>
                        <div className="text-sm font-medium">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div><Label>Título (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Visita inicial - Out/2025" /></div>
            </div>
            <DialogFooter><Button onClick={create}>Criar e abrir</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {surveys.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Sem levantamentos.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {surveys.map((s) => {
            const t = getSurveyTypeMeta(s.type, s.customTypeId);
            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <Link to="/levantamentos/$id" params={{ id: s.id }} search={{ mode: "read" }} className="flex-1 flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><ClipboardList className="h-4 w-4" /></div>
                    <div>
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{t.label} • {new Date(s.createdAt).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir levantamento?")) deleteSurvey(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}