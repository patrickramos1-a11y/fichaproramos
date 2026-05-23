import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useDB, addSurveyExt, addClient, useCustomSurveyTypes,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type SurveyType } from "@/lib/types";
import { useMemo, useState } from "react";
import { autoColor } from "@/lib/colors";
import { getTypeIcon } from "@/lib/typeIcons";
import { Search, UserPlus, Check } from "lucide-react";

export const Route = createFileRoute("/levantamentos/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
  }),
  component: NovoPage,
});

function NovoPage() {
  const db = useDB();
  const search = Route.useSearch();
  const allTypes = useCustomSurveyTypes().filter((c) => !c.archivedAt && !c.inactive);
  const nav = useNavigate();
  const [customTypeId, setCustomTypeId] = useState<string | undefined>(allTypes[0]?.id);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>(search.clientId ?? "");
  const [empreendimentoId, setEmpreendimentoId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");
  const [clientQuery, setClientQuery] = useState("");

  const selected = allTypes.find((c) => c.id === customTypeId) ?? allTypes[0];
  const effectiveType: SurveyType = (selected?.sourceTypeId as SurveyType | undefined) ?? selected?.id ?? "geral";
  const selectedClient = db.clients.find((c) => c.id === clientId);
  const clientEmpreendimentos = db.empreendimentos.filter((e) => e.clientId === clientId);
  const clientProjects = db.projects.filter((p) => p.clientId === clientId);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    const list = [...db.clients].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list.slice(0, 8);
    return list.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [db.clients, clientQuery]);

  const exactMatch = filteredClients.some(
    (c) => c.name.toLowerCase() === clientQuery.trim().toLowerCase(),
  );
  const canQuickAdd = clientQuery.trim().length > 0 && !exactMatch;

  function selectType(id: string, label: string) {
    setCustomTypeId(id);
    if (!title) setTitle(label);
  }
  function defaultTitle() {
    return selected?.label ?? "Levantamento";
  }

  function quickAddClient() {
    const name = clientQuery.trim();
    if (!name) return;
    const c = addClient({ name, personType: "PJ" });
    setClientId(c.id);
    setEmpreendimentoId("none");
    setProjectId("none");
    setClientQuery("");
  }

  function submit() {
    if (!clientId || !selected) return;
    const s = addSurveyExt({
      clientId,
      empreendimentoId: empreendimentoId === "none" ? undefined : empreendimentoId,
      projectId: projectId === "none" ? undefined : projectId,
      type: effectiveType,
      title: title || defaultTitle(),
      customTypeId: selected.id,
    });
    nav({ to: "/levantamentos/$id", params: { id: s.id }, search: { mode: "edit" } });
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">Novo levantamento</h1>
      <Card className="max-w-2xl">
        <CardContent className="p-6 grid gap-5">
          <div>
            <Label>Cliente *</Label>
            {selectedClient ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{selectedClient.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {selectedClient.personType === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                      {selectedClient.cnpjCpf ? ` · ${selectedClient.cnpjCpf}` : ""}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setClientId(""); setEmpreendimentoId("none"); setProjectId("none"); }}>Trocar</Button>
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-8"
                    placeholder="Buscar cliente pelo nome..."
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
                <div className="rounded-md border border-border max-h-64 overflow-y-auto">
                  {filteredClients.length === 0 && !canQuickAdd && (
                    <div className="p-3 text-xs text-muted-foreground">Nenhum cliente cadastrado ainda.</div>
                  )}
                  {filteredClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    >
                      <span className="truncate">{c.name}</span>
                      {c.cnpjCpf && (
                        <span className="text-[11px] text-muted-foreground truncate">{c.cnpjCpf}</span>
                      )}
                    </button>
                  ))}
                  {canQuickAdd && (
                    <button
                      type="button"
                      onClick={quickAddClient}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t border-border bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar cliente “{clientQuery.trim()}”
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Não precisa de projeto ou pasta. O levantamento será criado direto sob o cliente.
                </p>
              </div>
            )}
          </div>
          {selectedClient && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Empreendimento</Label>
                <Select value={empreendimentoId} onValueChange={setEmpreendimentoId}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem empreendimento</SelectItem>
                    {clientEmpreendimentos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Select value={projectId} onValueChange={(value) => {
                  setProjectId(value);
                  const project = db.projects.find((p) => p.id === value);
                  if (project?.empreendimentoId) setEmpreendimentoId(project.empreendimentoId);
                }}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {clientProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Projeto e empreendimento agora são contexto opcional; o vínculo principal é o cliente.
              </p>
            </div>
          )}
          <div>
            <Label className="mb-2 block">Tipo de levantamento</Label>
            <div className="grid gap-2">
              {allTypes.map((c) => {
                const Icon = getTypeIcon(c.icon);
                const isActive = customTypeId === c.id;
                const color = c.color ?? autoColor(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${isActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <input
                      type="radio"
                      className="mt-1"
                      checked={isActive}
                      onChange={() => selectType(c.id, c.label)}
                    />
                    <span
                      className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0"
                      style={{ backgroundColor: color, color: "white" }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.label}</div>
                      {c.description && (
                        <div className="text-xs text-muted-foreground">{c.description}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {c.moduleBindings.length} módulo(s) vinculado(s)
                      </div>
                    </div>
                  </label>
                );
              })}
              {allTypes.length === 0 && (
                <div className="text-xs text-muted-foreground">
                  Nenhum tipo cadastrado. Crie um em Configurações → Tipos de levantamento.
                </div>
              )}
            </div>
          </div>
          <div><Label>Título (opcional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <Button onClick={submit} disabled={!clientId || !selected}>
            Criar levantamento
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
