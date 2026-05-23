import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useDB, addProject, deleteProject, addEmpreendimento, deleteEmpreendimento, updateClient } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowLeft, FolderKanban, Building2, Pencil } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClienteForm, emptyClienteForm, type ClienteFormValue } from "@/components/ClienteForm";

export const Route = createFileRoute("/clientes/$id")({
  component: ClienteDetail,
});

function ClienteDetail() {
  const { id } = Route.useParams();
  const db = useDB();
  const nav = useNavigate();
  const client = db.clients.find((c) => c.id === id);
  const empreendimentos = db.empreendimentos.filter((e) => e.clientId === id);
  const projects = db.projects.filter((p) => p.clientId === id);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", empreendimentoId: "" });
  const [empOpen, setEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState({
    name: "", cnpjCpf: "", atividade: "", cnae: "",
    endereco: "", bairro: "", cidade: "", uf: "", cep: "",
    latitude: "", longitude: "", contatoLocal: "", telefoneLocal: "", notes: "",
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<ClienteFormValue>(emptyClienteForm());

  if (!client) return <AppShell><p>Cliente não encontrado.</p></AppShell>;

  function submit() {
    if (!form.name.trim()) return;
    const p = addProject({
      clientId: id,
      name: form.name,
      description: form.description,
      empreendimentoId: form.empreendimentoId || undefined,
    });
    setForm({ name: "", description: "", empreendimentoId: "" });
    setOpen(false);
    nav({ to: "/projetos/$id", params: { id: p.id } });
  }

  function submitEmp() {
    if (!empForm.name.trim()) return;
    addEmpreendimento({ clientId: id, ...empForm });
    setEmpForm({
      name: "", cnpjCpf: "", atividade: "", cnae: "",
      endereco: "", bairro: "", cidade: "", uf: "", cep: "",
      latitude: "", longitude: "", contatoLocal: "", telefoneLocal: "", notes: "",
    });
    setEmpOpen(false);
  }

  function openEdit() {
    if (!client) return;
    const { id: _i, createdAt: _c, ...rest } = client;
    setEditForm({ ...emptyClienteForm(), ...rest });
    setEditOpen(true);
  }
  function submitEdit() {
    if (!editForm.name.trim()) return;
    updateClient(id, editForm);
    setEditOpen(false);
  }

  return (
    <AppShell>
      <Link to="/clientes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">{client.personType === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</div>
            <CardTitle>{client.name}</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Editar</Button>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">CNPJ/CPF: </span>{client.cnpjCpf || "—"}</div>
          <div><span className="text-muted-foreground">IE/IM: </span>{client.ie || "—"} / {client.im || "—"}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">Endereço: </span>{[client.address, client.bairro, client.cidade, client.uf, client.cep].filter(Boolean).join(", ") || "—"}</div>
          <div><span className="text-muted-foreground">Contato: </span>{client.contact || "—"}</div>
          <div><span className="text-muted-foreground">Telefone: </span>{client.phone || "—"}</div>
          <div className="sm:col-span-2"><span className="text-muted-foreground">E-mail: </span>{client.email || "—"}</div>
          {client.repNome && (
            <div className="sm:col-span-2 mt-2 border-t pt-2">
              <div className="text-xs text-muted-foreground mb-1">Representante legal</div>
              <div>{client.repNome} {client.repCargo ? `— ${client.repCargo}` : ""}</div>
              <div className="text-xs text-muted-foreground">RG {client.repRg || "—"} • CPF {client.repCpf || "—"} • {client.repEmail || ""} {client.repPhone ? `• ${client.repPhone}` : ""}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empreendimentos */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Empreendimentos</h2>
        <Dialog open={empOpen} onOpenChange={setEmpOpen}>
          <Button type="button" size="sm" variant="outline" onClick={() => setEmpOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo empreendimento</Button>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo empreendimento</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome do empreendimento *</Label><Input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CNPJ (se diferente do cliente)</Label><Input value={empForm.cnpjCpf} onChange={(e) => setEmpForm({ ...empForm, cnpjCpf: e.target.value })} /></div>
                <div><Label>CNAE</Label><Input value={empForm.cnae} onChange={(e) => setEmpForm({ ...empForm, cnae: e.target.value })} /></div>
              </div>
              <div><Label>Atividade exercida</Label><Textarea value={empForm.atividade} onChange={(e) => setEmpForm({ ...empForm, atividade: e.target.value })} /></div>
              <div><Label>Endereço do empreendimento</Label><Input value={empForm.endereco} onChange={(e) => setEmpForm({ ...empForm, endereco: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Bairro</Label><Input value={empForm.bairro} onChange={(e) => setEmpForm({ ...empForm, bairro: e.target.value })} /></div>
                <div><Label>CEP</Label><Input value={empForm.cep} onChange={(e) => setEmpForm({ ...empForm, cep: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><Label>Cidade</Label><Input value={empForm.cidade} onChange={(e) => setEmpForm({ ...empForm, cidade: e.target.value })} /></div>
                <div><Label>UF</Label><Input value={empForm.uf} onChange={(e) => setEmpForm({ ...empForm, uf: e.target.value.toUpperCase().slice(0, 2) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input value={empForm.latitude} onChange={(e) => setEmpForm({ ...empForm, latitude: e.target.value })} /></div>
                <div><Label>Longitude</Label><Input value={empForm.longitude} onChange={(e) => setEmpForm({ ...empForm, longitude: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contato no local</Label><Input value={empForm.contatoLocal} onChange={(e) => setEmpForm({ ...empForm, contatoLocal: e.target.value })} /></div>
                <div><Label>Telefone no local</Label><Input value={empForm.telefoneLocal} onChange={(e) => setEmpForm({ ...empForm, telefoneLocal: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={empForm.notes} onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submitEmp}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {empreendimentos.length === 0 ? (
        <Card className="mb-6"><CardContent className="p-6 text-center text-sm text-muted-foreground">Sem empreendimentos. O empreendimento é o local físico onde o levantamento acontece.</CardContent></Card>
      ) : (
        <div className="grid gap-3 mb-6">
          {empreendimentos.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{e.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{e.atividade || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">{[e.endereco, e.cidade, e.uf].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir empreendimento? Os projetos vinculados serão desvinculados.")) deleteEmpreendimento(e.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Projetos</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button type="button" size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Novo projeto</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome do projeto *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Empreendimento</Label>
                {empreendimentos.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Cadastre um empreendimento acima para vincular ao projeto.</p>
                ) : (
                  <Select value={form.empreendimentoId} onValueChange={(v) => setForm({ ...form, empreendimentoId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                    <SelectContent>
                      {empreendimentos.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>Criar projeto</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Sem projetos cadastrados.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-4">
                <Link to="/projetos/$id" params={{ id: p.id }} className="flex-1 flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><FolderKanban className="h-4 w-4" /></div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.description || "—"}</div>
                  </div>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Excluir projeto?")) deleteProject(p.id); }}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <ClienteForm value={editForm} onChange={setEditForm} />
          <DialogFooter><Button onClick={submitEdit}>Salvar alterações</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}