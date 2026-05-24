import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { addClient, addSurveyExt, useCustomSurveyTypes, useDB } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { type SurveyType } from "@/lib/types";
import { autoColor } from "@/lib/colors";
import { getTypeIcon } from "@/lib/typeIcons";
import { Check, Search, UserPlus, Users, CalendarDays, PencilLine } from "lucide-react";

export const Route = createFileRoute("/levantamentos/novo")({
  validateSearch: (search: Record<string, unknown>) => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
  }),
  component: NovoPage,
});

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("pt-BR");
}

function buildDefaultTitle(typeLabel: string, date: Date) {
  return `${typeLabel} - ${formatDateLabel(date)}`;
}

function NovoPage() {
  const db = useDB();
  const search = Route.useSearch();
  const nav = useNavigate();
  const allTypes = useCustomSurveyTypes().filter((type) => !type.archivedAt && !type.inactive);

  const [customTypeId, setCustomTypeId] = useState<string | undefined>(allTypes[0]?.id);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState<string>(search.clientId ?? "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientPickerOpen, setClientPickerOpen] = useState(!search.clientId);

  const selected = allTypes.find((type) => type.id === customTypeId) ?? allTypes[0];
  const effectiveType: SurveyType = (selected?.sourceTypeId as SurveyType | undefined) ?? selected?.id ?? "geral";
  const selectedClient = db.clients.find((client) => client.id === clientId);
  const now = new Date();

  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    if (!query) return [];
    return [...db.clients]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((client) => {
        const doc = client.cnpjCpf?.toLowerCase() ?? "";
        return client.name.toLowerCase().includes(query) || doc.includes(query);
      })
      .slice(0, 8);
  }, [db.clients, clientQuery]);

  const exactMatch = filteredClients.some(
    (client) => client.name.toLowerCase() === clientQuery.trim().toLowerCase(),
  );
  const canQuickAdd = clientQuery.trim().length > 1 && !exactMatch;
  const generatedTitle = buildDefaultTitle(selected?.label ?? "Levantamento", now);

  function selectType(id: string) {
    setCustomTypeId(id);
  }

  function quickAddClient() {
    const name = clientQuery.trim();
    if (!name) return;
    const client = addClient({ name, personType: "PJ" });
    setClientId(client.id);
    setClientQuery("");
    setClientPickerOpen(false);
  }

  function submit() {
    if (!clientId || !selected) return;
    const survey = addSurveyExt({
      clientId,
      type: effectiveType,
      title: title.trim() || generatedTitle,
      customTypeId: selected.id,
    });
    nav({ to: "/levantamentos/$id", params: { id: survey.id }, search: { mode: "edit" } });
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Novo levantamento</h1>
      <Card className="max-w-3xl">
        <CardContent className="grid gap-6 p-4 sm:p-6">
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Cliente *</Label>
              {selectedClient && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setClientPickerOpen((open) => !open)}
                >
                  {clientPickerOpen ? "Fechar" : "Trocar"}
                </Button>
              )}
            </div>

            {selectedClient && !clientPickerOpen ? (
              <button
                type="button"
                onClick={() => setClientPickerOpen(true)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{selectedClient.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedClient.personType === "PF" ? "Pessoa Fisica" : "Pessoa Juridica"}
                      {selectedClient.cnpjCpf ? ` - ${selectedClient.cnpjCpf}` : ""}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-primary">Trocar</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    className="pl-9"
                    placeholder="Digite para buscar ou cadastrar cliente"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                </div>
                {clientQuery.trim().length > 0 && (
                  <div className="max-h-[38dvh] overflow-y-auto rounded-xl border border-border overscroll-contain">
                    {filteredClients.length === 0 && !canQuickAdd && (
                      <div className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
                    )}
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setClientId(client.id);
                          setClientPickerOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{client.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {client.personType === "PF" ? "Pessoa Fisica" : "Pessoa Juridica"}
                          </div>
                        </div>
                        {client.cnpjCpf && (
                          <span className="truncate text-[11px] text-muted-foreground">{client.cnpjCpf}</span>
                        )}
                      </button>
                    ))}
                    {canQuickAdd && (
                      <button
                        type="button"
                        onClick={quickAddClient}
                        className="flex w-full items-center gap-2 border-t border-border bg-primary/5 px-3 py-3 text-left text-sm text-primary transition-colors hover:bg-primary/10"
                      >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar cliente "{clientQuery.trim()}"
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  O levantamento nasce direto no cliente. Projeto e empreendimento deixam de ser obrigatorios aqui.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>Tipo de levantamento</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {allTypes.map((type) => {
                const Icon = getTypeIcon(type.icon);
                const isActive = customTypeId === type.id;
                const color = type.color ?? autoColor(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => selectType(type.id)}
                    className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color, color: "white" }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium">{type.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {type.moduleBindings.length} modulo(s)
                      </span>
                    </span>
                    <span className={`h-4 w-4 shrink-0 rounded-full border ${isActive ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <PencilLine className="h-4 w-4 text-muted-foreground" />
              <Label>Titulo (opcional)</Label>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={generatedTitle}
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Se ficar vazio, o sistema usa: {generatedTitle}
              </span>
            </div>
          </section>

          <Button onClick={submit} disabled={!clientId || !selected} className="h-12 text-base">
            Criar levantamento
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
