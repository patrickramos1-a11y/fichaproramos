import { useEffect, useMemo, useState } from "react";
import { MODULES, getModulesForType } from "@/lib/modules";
import { SURVEY_TYPES } from "@/lib/types";
import type { FieldDef, FieldType, ModuleDef, SubgroupDef, FieldPatch } from "@/lib/types";
import {
  useDBSelector, setFieldPatch, setSubgroupPatch, addCustomField,
  removeCustomField, addCustomSubgroup, removeCustomSubgroup,
} from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Plus, Trash2, ChevronRight, EyeOff, Eye, Pencil, Layers, ListTree, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "quantity", label: "Quantidade (stepper)" },
  { value: "date", label: "Data" },
  { value: "time", label: "Horário" },
  { value: "select", label: "Seleção única (lista)" },
  { value: "multiselect", label: "Seleção múltipla (lista)" },
  { value: "button-select", label: "Botões de seleção" },
  { value: "boolean", label: "Sim / Não" },
  { value: "coords", label: "Coordenadas" },
  { value: "people", label: "Pessoas" },
  { value: "hours-presets", label: "Horários / Turnos" },
  { value: "repeater", label: "Lista repetível" },
  { value: "apply-to-sides", label: "Aplicar por lado" },
];

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || `c${Date.now().toString(36)}`;

export function EstruturaFormulariosTab({
  initialModuleId,
  onConsumed,
}: {
  initialModuleId?: string;
  onConsumed?: () => void;
}) {
  const overrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);

  // Catálogo "efetivo": preferimos passar pelo getModulesForType (todos os tipos) e dedupe por id.
  const catalog: ModuleDef[] = useMemo(() => {
    const map = new Map<string, ModuleDef>();
    for (const t of SURVEY_TYPES) for (const m of getModulesForType(t.id)) if (!map.has(m.id)) map.set(m.id, m);
    // Garante que módulos sem tipo (raros) também aparecem
    for (const m of MODULES) if (!map.has(m.id)) map.set(m.id, m);
    return Array.from(map.values());
  }, [overrides]);

  const [moduleId, setModuleId] = useState<string>(initialModuleId ?? catalog[0]?.id ?? "");
  const [subgroupId, setSubgroupId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ subgroupId: string; field: FieldDef; isCustom: boolean } | null>(null);
  const [newSubgroupOpen, setNewSubgroupOpen] = useState(false);

  useEffect(() => {
    if (initialModuleId) {
      setModuleId(initialModuleId);
      setSubgroupId(null);
      onConsumed?.();
    }
  }, [initialModuleId]);

  const selectedModule = catalog.find((m) => m.id === moduleId);
  const subgroups = selectedModule?.subgroups ?? [];
  // Auto-selecionar primeiro subgrupo
  useEffect(() => {
    if (selectedModule && !subgroupId && subgroups.length) setSubgroupId(subgroups[0].id);
  }, [selectedModule?.id]);
  const selectedSub = subgroups.find((s) => s.id === subgroupId) ?? null;

  function addSubgroup(title: string) {
    if (!selectedModule || !title.trim()) return;
    const id = slug(title);
    if (subgroups.some((s) => s.id === id)) {
      toast.error("Já existe um subgrupo com nome semelhante.");
      return;
    }
    addCustomSubgroup(selectedModule.id, { id, title: title.trim(), fields: [] });
    setSubgroupId(id);
    toast.success("Subgrupo criado.");
  }

  function deleteSubgroup(sgId: string) {
    if (!selectedModule) return;
    // Apenas customizados podem ser excluídos
    const isCustom = !!overrides.customSubgroups?.[selectedModule.id]?.some((s) => s.id === sgId);
    if (isCustom) {
      removeCustomSubgroup(selectedModule.id, sgId);
      if (subgroupId === sgId) setSubgroupId(null);
      toast.success("Subgrupo removido.");
    } else {
      // Subgrupo de fábrica: ocultar
      setSubgroupPatch(selectedModule.id, sgId, { hidden: true });
      toast.success("Subgrupo ocultado.");
    }
  }

  function addField(subId: string, label: string) {
    if (!selectedModule || !label.trim()) return;
    const fid = slug(label);
    addCustomField(selectedModule.id, subId, { id: fid, label: label.trim(), type: "text" });
    toast.success("Campo adicionado.");
  }

  function deleteField(subId: string, field: FieldDef, isCustom: boolean) {
    if (!selectedModule) return;
    if (isCustom) {
      removeCustomField(selectedModule.id, subId, field.id);
      toast.success("Campo removido.");
    } else {
      setFieldPatch(selectedModule.id, subId, field.id, { hidden: true });
      toast.success("Campo ocultado.");
    }
  }

  function restoreField(subId: string, fieldId: string) {
    if (!selectedModule) return;
    setFieldPatch(selectedModule.id, subId, fieldId, null);
    toast.success("Campo restaurado.");
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr] min-h-[60vh]">
        {/* Coluna 1 — Módulos */}
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulos</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{catalog.length}</Badge>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y max-h-[60vh]">
            {catalog.map((m) => {
              const active = m.id === moduleId;
              const subs = m.subgroups?.length ?? 0;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => { setModuleId(m.id); setSubgroupId(null); }}
                    className={`w-full text-left px-3 py-2 transition-colors ${active ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium leading-tight flex-1 min-w-0 truncate">{m.title}</span>
                      <Badge variant="secondary" className="text-[10px]">{subs}</Badge>
                      <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 ${active ? "text-primary" : ""}`} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Coluna 2 — Subgrupos */}
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subgrupos</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{subgroups.length}</Badge>
          </div>
          {selectedModule ? (
            <>
              <ul className="flex-1 overflow-y-auto divide-y max-h-[55vh]">
                {subgroups.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">Nenhum subgrupo.</li>
                )}
                {subgroups.map((sg) => {
                  const active = sg.id === subgroupId;
                  const isCustom = !!overrides.customSubgroups?.[selectedModule.id]?.some((s) => s.id === sg.id);
                  return (
                    <li key={sg.id}>
                      <div className={`flex items-stretch ${active ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/50"}`}>
                        <button onClick={() => setSubgroupId(sg.id)} className="flex-1 text-left px-3 py-2 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium leading-tight truncate flex-1">{sg.title}</span>
                            {isCustom && <Badge className="text-[9px] py-0 h-4">Custom</Badge>}
                            <Badge variant="secondary" className="text-[10px]">{sg.fields.length}</Badge>
                          </div>
                          {sg.description && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sg.description}</p>}
                        </button>
                        <button
                          onClick={() => deleteSubgroup(sg.id)}
                          title={isCustom ? "Remover" : "Ocultar"}
                          className="px-2 text-muted-foreground hover:text-destructive"
                        >
                          {isCustom ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t p-2 bg-muted/20">
                <NewSubgroupRow open={newSubgroupOpen} setOpen={setNewSubgroupOpen} onCreate={addSubgroup} />
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">Selecione um módulo</div>
          )}
        </Card>

        {/* Coluna 3 — Campos */}
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos / Perguntas</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{selectedSub?.fields.length ?? 0}</Badge>
          </div>
          {selectedSub ? (
            <>
              <ul className="flex-1 overflow-y-auto divide-y max-h-[55vh]">
                {selectedSub.fields.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">Nenhum campo neste subgrupo.</li>
                )}
                {selectedSub.fields.map((f) => {
                  const isCustom = !!overrides.customFields?.[`${selectedModule!.id}.${selectedSub.id}`]?.some((cf) => cf.id === f.id);
                  return (
                    <li key={f.id} className="px-3 py-2 hover:bg-secondary/40 group flex items-center gap-2">
                      <button
                        onClick={() => setEditingField({ subgroupId: selectedSub.id, field: f, isCustom })}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate flex-1">{f.label}</span>
                          <Badge variant="outline" className="text-[10px]">{labelOfType(f.type)}</Badge>
                          {isCustom && <Badge className="text-[9px] py-0 h-4">Custom</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">id: {f.id}{f.unit ? ` · ${f.unit}` : ""}</div>
                      </button>
                      <button
                        onClick={() => setEditingField({ subgroupId: selectedSub.id, field: f, isCustom })}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteField(selectedSub.id, f, isCustom)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title={isCustom ? "Remover" : "Ocultar"}
                      >
                        {isCustom ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/* Campos ocultos (de fábrica) — permite restaurar */}
              <HiddenFieldsBar
                moduleId={selectedModule!.id}
                subgroupId={selectedSub.id}
                onRestore={(fid) => restoreField(selectedSub.id, fid)}
              />
              <div className="border-t p-2 bg-muted/20">
                <NewFieldRow onCreate={(label) => addField(selectedSub.id, label)} />
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">Selecione um subgrupo</div>
          )}
        </Card>
      </div>

      <FieldEditorSheet
        editing={editingField}
        moduleId={selectedModule?.id}
        onClose={() => setEditingField(null)}
      />
    </>
  );
}

function labelOfType(t: FieldType) {
  return FIELD_TYPES.find((x) => x.value === t)?.label ?? t;
}

function NewSubgroupRow({ open, setOpen, onCreate }: { open: boolean; setOpen: (v: boolean) => void; onCreate: (title: string) => void }) {
  const [v, setV] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar subgrupo
      </Button>
    );
  }
  return (
    <div className="flex gap-1.5">
      <Input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) { onCreate(v); setV(""); setOpen(false); }
          if (e.key === "Escape") { setV(""); setOpen(false); }
        }}
        placeholder="Nome do subgrupo"
        className="h-8 text-sm"
      />
      <Button size="sm" onClick={() => { if (v.trim()) { onCreate(v); setV(""); setOpen(false); } }}>OK</Button>
    </div>
  );
}

function NewFieldRow({ onCreate }: { onCreate: (label: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-1.5">
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) { onCreate(v); setV(""); }
        }}
        placeholder="Adicionar campo (Enter)"
        className="h-8 text-sm"
      />
      <Button size="sm" variant="outline" disabled={!v.trim()} onClick={() => { if (v.trim()) { onCreate(v); setV(""); } }}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function HiddenFieldsBar({ moduleId, subgroupId, onRestore }: { moduleId: string; subgroupId: string; onRestore: (fieldId: string) => void }) {
  const overrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);
  const hidden = Object.entries(overrides.fields ?? {})
    .filter(([key, p]) => key.startsWith(`${moduleId}.${subgroupId}.`) && p.hidden)
    .map(([key]) => key.split(".").slice(2).join("."));
  if (!hidden.length) return null;
  return (
    <div className="border-t bg-muted/40 px-3 py-1.5 flex items-center gap-2 flex-wrap">
      <Eye className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Ocultos:</span>
      {hidden.map((id) => (
        <button
          key={id}
          onClick={() => onRestore(id)}
          className="text-[11px] rounded border px-1.5 py-0.5 hover:bg-background"
          title="Restaurar"
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />{id}
        </button>
      ))}
    </div>
  );
}

function FieldEditorSheet({
  editing, moduleId, onClose,
}: {
  editing: { subgroupId: string; field: FieldDef; isCustom: boolean } | null;
  moduleId?: string;
  onClose: () => void;
}) {
  const overrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [unit, setUnit] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [multi, setMulti] = useState(false);
  const [allowOther, setAllowOther] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!editing || !moduleId) return;
    const key = `${moduleId}.${editing.subgroupId}.${editing.field.id}`;
    const patch = overrides.fields?.[key];
    const merged = { ...editing.field, ...patch };
    setLabel(merged.label ?? "");
    setType((merged.type as FieldType) ?? "text");
    setUnit(merged.unit ?? "");
    setPlaceholder(merged.placeholder ?? "");
    setOptionsText((merged.options ?? []).join("\n"));
    setMulti(!!merged.multi);
    setAllowOther(!!merged.allowOther);
    setHidden(!!patch?.hidden);
  }, [editing, moduleId, overrides]);

  if (!editing || !moduleId) return null;

  const showOptions = type === "select" || type === "multiselect" || type === "button-select";

  function save() {
    if (!moduleId || !editing) return;
    const opts = optionsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const patch: FieldPatch = {
      label,
      type,
      unit: unit || undefined,
      placeholder: placeholder || undefined,
      options: showOptions && opts.length ? opts : undefined,
      multi: type === "button-select" ? multi : undefined,
      allowOther: showOptions ? allowOther : undefined,
      hidden: hidden || undefined,
    };
    setFieldPatch(moduleId, editing.subgroupId, editing.field.id, patch);
    toast.success("Campo atualizado.");
    onClose();
  }

  function reset() {
    if (!moduleId || !editing) return;
    setFieldPatch(moduleId, editing.subgroupId, editing.field.id, null);
    toast.success("Personalização removida.");
    onClose();
  }

  return (
    <Sheet open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar campo</SheetTitle>
          <SheetDescription>
            ID interno: <code className="text-xs">{editing.field.id}</code>{editing.isCustom && " · Customizado"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Rótulo (visível)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de resposta</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {(type === "number" || type === "quantity") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade (ex.: m, kg, L)</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          )}

          {type === "text" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Placeholder</Label>
              <Input value={placeholder} onChange={(e) => setPlaceholder(e.target.value)} />
            </div>
          )}

          {showOptions && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Opções (uma por linha)</Label>
                <Textarea rows={6} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs cursor-pointer">Permitir resposta livre ("Outro")</Label>
                <Switch checked={allowOther} onCheckedChange={(v) => setAllowOther(!!v)} />
              </div>
              {type === "button-select" && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs cursor-pointer">Permitir múltipla seleção</Label>
                  <Switch checked={multi} onCheckedChange={(v) => setMulti(!!v)} />
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between border-t pt-3">
            <Label className="text-xs cursor-pointer text-destructive">Ocultar este campo dos formulários</Label>
            <Switch checked={hidden} onCheckedChange={(v) => setHidden(!!v)} />
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={reset}>Restaurar padrão</Button>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save}>Salvar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
