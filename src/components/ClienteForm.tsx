import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Client } from "@/lib/types";

export type ClienteFormValue = Omit<Client, "id" | "createdAt">;

export const emptyClienteForm = (): ClienteFormValue => ({
  name: "",
  personType: "PJ",
  cnpjCpf: "",
  ie: "",
  im: "",
  address: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  contact: "",
  phone: "",
  email: "",
  repNome: "",
  repRg: "",
  repCpf: "",
  repCargo: "",
  repEmail: "",
  repPhone: "",
  notes: "",
});

export function ClienteForm({
  value,
  onChange,
}: {
  value: ClienteFormValue;
  onChange: (v: ClienteFormValue) => void;
}) {
  const set = (patch: Partial<ClienteFormValue>) => onChange({ ...value, ...patch });

  return (
    <Tabs defaultValue="cad" className="w-full">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="cad">Cadastrais</TabsTrigger>
        <TabsTrigger value="end">Endereço & Contato</TabsTrigger>
        <TabsTrigger value="rep">Representante</TabsTrigger>
      </TabsList>

      <TabsContent value="cad" className="grid gap-3 pt-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo</Label>
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={value.personType ?? "PJ"}
              onChange={(e) => set({ personType: e.target.value as "PJ" | "PF" })}
            >
              <option value="PJ">Pessoa Jurídica</option>
              <option value="PF">Pessoa Física</option>
            </select>
          </div>
          <div>
            <Label>{value.personType === "PF" ? "CPF" : "CNPJ"}</Label>
            <Input value={value.cnpjCpf ?? ""} onChange={(e) => set({ cnpjCpf: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{value.personType === "PF" ? "Nome completo *" : "Razão social *"}</Label>
          <Input value={value.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        {value.personType !== "PF" && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Inscrição Estadual</Label><Input value={value.ie ?? ""} onChange={(e) => set({ ie: e.target.value })} /></div>
            <div><Label>Inscrição Municipal</Label><Input value={value.im ?? ""} onChange={(e) => set({ im: e.target.value })} /></div>
          </div>
        )}
        <div>
          <Label>Observações</Label>
          <Textarea value={value.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </TabsContent>

      <TabsContent value="end" className="grid gap-3 pt-3">
        <div><Label>Endereço</Label><Input value={value.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bairro</Label><Input value={value.bairro ?? ""} onChange={(e) => set({ bairro: e.target.value })} /></div>
          <div><Label>CEP</Label><Input value={value.cep ?? ""} onChange={(e) => set({ cep: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><Label>Cidade</Label><Input value={value.cidade ?? ""} onChange={(e) => set({ cidade: e.target.value })} /></div>
          <div><Label>UF</Label><Input value={value.uf ?? ""} onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Contato</Label><Input value={value.contact ?? ""} onChange={(e) => set({ contact: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={value.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} /></div>
        </div>
        <div><Label>E-mail</Label><Input value={value.email ?? ""} onChange={(e) => set({ email: e.target.value })} /></div>
      </TabsContent>

      <TabsContent value="rep" className="grid gap-3 pt-3">
        <p className="text-xs text-muted-foreground">Dados do representante legal (utilizados em outorga e documentos oficiais).</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={value.repNome ?? ""} onChange={(e) => set({ repNome: e.target.value })} /></div>
          <div><Label>Cargo</Label><Input value={value.repCargo ?? ""} onChange={(e) => set({ repCargo: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>RG</Label><Input value={value.repRg ?? ""} onChange={(e) => set({ repRg: e.target.value })} /></div>
          <div><Label>CPF</Label><Input value={value.repCpf ?? ""} onChange={(e) => set({ repCpf: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input value={value.repEmail ?? ""} onChange={(e) => set({ repEmail: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={value.repPhone ?? ""} onChange={(e) => set({ repPhone: e.target.value })} /></div>
        </div>
      </TabsContent>
    </Tabs>
  );
}