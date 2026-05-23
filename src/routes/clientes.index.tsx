import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useDB, addClient } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClienteForm, emptyClienteForm, type ClienteFormValue } from "@/components/ClienteForm";
import { Plus, Search, Users, ArrowRight, Building2 } from "lucide-react";

export const Route = createFileRoute("/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Ramos Engenharia" }] }),
  component: ClientesList,
});

function ClientesList() {
  const db = useDB();
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClienteFormValue>(emptyClienteForm());

  const filtered = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    const list = term
      ? db.clients.filter((c) =>
          [c.name, c.cnpjCpf, c.cidade, c.uf]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(term)),
        )
      : db.clients;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [db.clients, deferredQ]);

  // Pré-calcula contagens para evitar O(n*m) por render
  const counts = useMemo(() => {
    const projByClient = new Map<string, number>();
    for (const p of db.projects) projByClient.set(p.clientId, (projByClient.get(p.clientId) ?? 0) + 1);
    const projToClient = new Map(db.projects.map((p) => [p.id, p.clientId]));
    const survByClient = new Map<string, number>();
    for (const s of db.surveys) {
      const cid = projToClient.get(s.projectId);
      if (cid) survByClient.set(cid, (survByClient.get(cid) ?? 0) + 1);
    }
    return { projByClient, survByClient };
  }, [db.projects, db.surveys]);

  function submit() {
    if (!form.name.trim()) return;
    addClient(form);
    setForm(emptyClienteForm());
    setOpen(false);
  }

  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{db.clients.length} cadastrado(s)</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CNPJ ou cidade…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            {db.clients.length === 0
              ? "Nenhum cliente cadastrado ainda."
              : "Nenhum cliente encontrado para a busca."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => {
            const projetos = counts.projByClient.get(c.id) ?? 0;
            const surveys = counts.survByClient.get(c.id) ?? 0;
            return (
              <Link key={c.id} to="/clientes/$id" params={{ id: c.id }}>
                <Card className="hover:border-primary transition-colors">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                      {c.personType === "PF" ? <Users className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.cnpjCpf || (c.personType === "PF" ? "Pessoa Física" : "Pessoa Jurídica")}
                        {(c.cidade || c.uf) && ` · ${[c.cidade, c.uf].filter(Boolean).join("/")}`}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {projetos} projeto(s) · {surveys} levantamento(s)
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <ClienteForm value={form} onChange={setForm} />
          <DialogFooter><Button onClick={submit}>Salvar cliente</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
