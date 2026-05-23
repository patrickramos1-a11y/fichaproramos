import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  ArrowLeft, ChevronRight, Layers, ListTree, Pencil, Plus, EyeOff, Eye,
  Trash2, ChevronUp, ChevronDown, RotateCcw, Search, Palette,
  PanelLeftClose, PanelLeftOpen, Check,
} from "lucide-react";
import { toast } from "sonner";
import { MODULES, getEffectiveModulesForCustomType } from "@/lib/modules";
import { autoColor } from "@/lib/colors";
import { TYPE_ICON_OPTIONS, getTypeIcon } from "@/lib/typeIcons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useDBSelector,
  useCustomSurveyTypes,
  updateCustomSurveyType,
  addTypeModule,
  removeTypeModule,
  moveTypeModule,
  setTypeModuleBindings,
  setTypeFieldPatch,
  setTypeSubgroupPatch,
  addTypeCustomSubgroup,
  removeTypeCustomSubgroup,
  addTypeCustomField,
  removeTypeCustomField,
} from "@/lib/store";
import type { FieldDef, FieldType, FieldPatch, ModuleRequirement } from "@/lib/types";

export const Route = createFileRoute("/configuracoes/tipos/$typeId")({
  head: () => ({
    meta: [
      { title: "Editar tipo de levantamento" },
      { name: "description", content: "Construtor visual de tipos de levantamento personalizados." },
    ],
  }),
  component: TipoBuilderPage,
});

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || `c${Date.now().toString(36)}`;

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "quantity", label: "Quantidade" },
  { value: "date", label: "Data" },
  { value: "time", label: "Horário" },
  { value: "select", label: "Seleção única" },
  { value: "multiselect", label: "Seleção múltipla" },
  { value: "button-select", label: "Botões de seleção" },
  { value: "boolean", label: "Sim / Não" },
  { value: "coords", label: "Coordenadas" },
  { value: "people", label: "Pessoas" },
  { value: "hours-presets", label: "Horários" },
  { value: "repeater", label: "Lista repetível" },
  { value: "apply-to-sides", label: "Aplicar por lado" },
  { value: "photo", label: "Foto" },
  { value: "document", label: "Documento" },
  { value: "audio", label: "Áudio" },
  { value: "drawing", label: "Desenho" },
  { value: "signature", label: "Assinatura" },
];

const REQUIREMENT_LABEL: Record<ModuleRequirement, string> = {
  obrigatorio: "Obrigatório",
  recomendado: "Recomendado",
  opcional: "Opcional",
};

const REQ_SHORT: Record<ModuleRequirement, string> = {
  obrigatorio: "Obr",
  recomendado: "Rec",
  opcional: "Opc",
};

const REQ_CYCLE: Record<ModuleRequirement, ModuleRequirement> = {
  obrigatorio: "recomendado",
  recomendado: "opcional",
  opcional: "obrigatorio",
};

const REQ_STYLE: Record<ModuleRequirement, string> = {
  obrigatorio: "bg-destructive/15 text-destructive border-destructive/30",
  recomendado: "bg-primary/10 text-primary border-primary/30",
  opcional: "bg-muted text-muted-foreground border-border",
};

function TipoBuilderPage() {
  const { typeId } = Route.useParams();
  const navigate = useNavigate();
  const customs = useCustomSurveyTypes();
  const ct = customs.find((c) => c.id === typeId);
  const globalOverrides = useDBSelector((s) => s.formOverrides ?? {}, (a, b) => a === b);

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [subgroupId, setSubgroupId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ subgroupId: string; field: FieldDef; isCustom: boolean } | null>(null);
  const [moduleSearch, setModuleSearch] = useState("");
  const [newSubgroupOpen, setNewSubgroupOpen] = useState(false);
  const [renamingHeader, setRenamingHeader] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");

  const [collapsed, setCollapsed] = useState<Record<"avail" | "mods" | "subs" | "fields", boolean>>({
    avail: false, mods: false, subs: false, fields: false,
  });
  function toggleCol(k: "avail" | "mods" | "subs" | "fields") {
    setCollapsed((c) => ({ ...c, [k]: !c[k] }));
  }

  useEffect(() => {
    if (ct) { setLabelDraft(ct.label); setDescDraft(ct.description ?? ""); }
  }, [ct?.id]);

  const effectiveModules = useMemo(
    () => (ct ? getEffectiveModulesForCustomType(ct, globalOverrides) : []),
    [ct, globalOverrides],
  );

  // Auto-select first linked module
  useEffect(() => {
    if (!moduleId && effectiveModules.length) setModuleId(effectiveModules[0].id);
  }, [effectiveModules.length]);

  const selectedModule = effectiveModules.find((m) => m.id === moduleId);
  const subgroups = selectedModule?.subgroups ?? [];

  useEffect(() => {
    if (selectedModule && !subgroupId && subgroups.length) setSubgroupId(subgroups[0].id);
    if (selectedModule && subgroupId && !subgroups.find((s) => s.id === subgroupId)) {
      setSubgroupId(subgroups[0]?.id ?? null);
    }
  }, [selectedModule?.id, subgroups.length]);

  if (!ct) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto py-12 text-center space-y-3">
          <h2 className="text-lg font-semibold">Tipo não encontrado</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/configuracoes">Voltar para Configurações</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const linkedIds = new Set(ct.moduleBindings.map((b) => b.moduleId));
  const availableModules = MODULES
    .filter((m) => !linkedIds.has(m.id))
    .filter((m) => !moduleSearch.trim() || m.title.toLowerCase().includes(moduleSearch.toLowerCase()));

  const selectedSub = subgroups.find((s) => s.id === subgroupId) ?? null;

  function commitHeader() {
    setRenamingHeader(false);
    const v = labelDraft.trim();
    if (v && (v !== ct!.label || descDraft !== (ct!.description ?? ""))) {
      updateCustomSurveyType(ct!.id, { label: v, description: descDraft.trim() || undefined });
      toast.success("Tipo atualizado.");
    }
  }

  function changeRequirement(mid: string, requirement: ModuleRequirement) {
    setTypeModuleBindings(
      ct!.id,
      ct!.moduleBindings.map((b) => b.moduleId === mid ? { ...b, requirement } : b),
    );
  }

  function addSubgroup(title: string) {
    if (!selectedModule || !title.trim()) return;
    const id = slug(title);
    if (subgroups.some((s) => s.id === id)) {
      toast.error("Já existe um subgrupo com nome semelhante.");
      return;
    }
    addTypeCustomSubgroup(ct!.id, selectedModule.id, { id, title: title.trim(), fields: [] });
    setSubgroupId(id);
    toast.success("Subgrupo criado neste tipo.");
  }

  function deleteSubgroup(sgId: string) {
    if (!selectedModule) return;
    const isCustom = !!ct!.scopedOverrides?.customSubgroups?.[selectedModule.id]?.some((s) => s.id === sgId);
    if (isCustom) {
      removeTypeCustomSubgroup(ct!.id, selectedModule.id, sgId);
      if (subgroupId === sgId) setSubgroupId(null);
      toast.success("Subgrupo removido.");
    } else {
      setTypeSubgroupPatch(ct!.id, selectedModule.id, sgId, { hidden: true });
      toast.success("Subgrupo ocultado neste tipo.");
    }
  }

  function addField(subId: string, label: string) {
    if (!selectedModule || !label.trim()) return;
    const fid = slug(label);
    addTypeCustomField(ct!.id, selectedModule.id, subId, { id: fid, label: label.trim(), type: "text" });
    toast.success("Campo adicionado neste tipo.");
  }

  function deleteField(subId: string, field: FieldDef, isCustom: boolean) {
    if (!selectedModule) return;
    if (isCustom) {
      removeTypeCustomField(ct!.id, selectedModule.id, subId, field.id);
      toast.success("Campo removido.");
    } else {
      setTypeFieldPatch(ct!.id, selectedModule.id, subId, field.id, { hidden: true });
      toast.success("Campo ocultado neste tipo.");
    }
  }

  return (
    <AppShell>
      <header className="mb-4 flex items-start gap-3">
        <Button asChild size="sm" variant="ghost" className="mt-0.5">
          <Link to="/configuracoes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          {renamingHeader ? (
            <div className="space-y-2 max-w-xl">
              <Input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && commitHeader()}
                className="text-lg font-semibold h-9"
              />
              <Textarea
                rows={2}
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Descrição (opcional)"
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={commitHeader}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRenamingHeader(false); setLabelDraft(ct.label); setDescDraft(ct.description ?? ""); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <IconColorPicker
                color={ct.color || autoColor(ct.id)}
                iconName={ct.icon}
                onChange={(next) => updateCustomSurveyType(ct.id, next)}
              />
              <button onClick={() => setRenamingHeader(true)} className="text-left group flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight group-hover:underline decoration-dotted underline-offset-4">
                    {ct.label}
                  </h1>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
                {ct.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{ct.description}</p>
                )}
              </button>
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => { toast.success("Edições salvas."); navigate({ to: "/configuracoes" }); }}
          className="mt-0.5 shrink-0"
        >
          <Check className="h-4 w-4 mr-1" /> Salvar e voltar
        </Button>
      </header>

      <div
        className="grid gap-3 min-h-[64vh]"
        style={{
          gridTemplateColumns: [
            collapsed.avail ? "44px" : "minmax(0,1.05fr)",
            collapsed.mods ? "44px" : "minmax(0,1.15fr)",
            collapsed.subs ? "44px" : "minmax(0,0.95fr)",
            collapsed.fields ? "44px" : "minmax(0,1fr)",
          ].join(" "),
        }}
      >
        {/* Coluna 1 — Módulos disponíveis */}
        {collapsed.avail ? (
          <CollapsedRail label="Disponíveis" count={availableModules.length} icon={Plus} onExpand={() => toggleCol("avail")} />
        ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Disponíveis</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{availableModules.length}</Badge>
            <button onClick={() => toggleCol("avail")} className="text-muted-foreground hover:text-foreground" title="Recolher">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="px-2 py-1.5 border-b">
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
                placeholder="Buscar módulo…"
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y max-h-[58vh]">
            {availableModules.map((m) => (
              <li key={m.id} className="px-3 py-2 hover:bg-secondary/40 group flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.title}</div>
                  {m.description && <div className="text-[11px] text-muted-foreground truncate">{m.description}</div>}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 opacity-70 group-hover:opacity-100"
                  onClick={() => { addTypeModule(ct.id, m.id, "opcional"); setModuleId(m.id); toast.success("Módulo vinculado."); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
            {availableModules.length === 0 && (
              <li className="p-4 text-center text-xs text-muted-foreground">
                {moduleSearch ? "Nenhum módulo encontrado." : "Todos os módulos já foram adicionados."}
              </li>
            )}
          </ul>
        </Card>
        )}

        {/* Coluna 2 — Módulos do tipo */}
        {collapsed.mods ? (
          <CollapsedRail label="Módulos do tipo" count={ct.moduleBindings.length} icon={Layers} onExpand={() => toggleCol("mods")} />
        ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulos do tipo</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{ct.moduleBindings.length}</Badge>
            <button onClick={() => toggleCol("mods")} className="text-muted-foreground hover:text-foreground" title="Recolher">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y max-h-[58vh]">
            {ct.moduleBindings.length === 0 && (
              <li className="p-4 text-center text-xs text-muted-foreground">
                Adicione módulos da coluna ao lado.
              </li>
            )}
            {ct.moduleBindings.map((b, idx) => {
              const m = MODULES.find((x) => x.id === b.moduleId);
              if (!m) return null;
              const active = m.id === moduleId;
              return (
                <li key={b.moduleId}>
                  <div className={`flex items-center ${active ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/50"}`}>
                    <button onClick={() => { setModuleId(m.id); setSubgroupId(null); }} className="flex-1 text-left min-w-0 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                        <span className="text-[13px] font-medium truncate flex-1">{m.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); changeRequirement(m.id, REQ_CYCLE[b.requirement]); }}
                          title={`Requisito: ${REQUIREMENT_LABEL[b.requirement]} (clique para alternar)`}
                          className={`text-[9px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${REQ_STYLE[b.requirement]}`}
                        >
                          {REQ_SHORT[b.requirement]}
                        </button>
                      </div>
                    </button>
                    <div className="flex flex-col items-center justify-center px-1 border-l">
                      <button onClick={() => moveTypeModule(ct.id, m.id, -1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Subir">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button onClick={() => moveTypeModule(ct.id, m.id, 1)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Descer">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => { removeTypeModule(ct.id, m.id); if (moduleId === m.id) setModuleId(null); }}
                      className="px-2 text-muted-foreground hover:text-destructive border-l"
                      title="Remover do tipo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        )}

        {/* Coluna 3 — Subgrupos */}
        {collapsed.subs ? (
          <CollapsedRail label="Subgrupos" count={subgroups.length} icon={ListTree} onExpand={() => toggleCol("subs")} />
        ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subgrupos</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{subgroups.length}</Badge>
            <button onClick={() => toggleCol("subs")} className="text-muted-foreground hover:text-foreground" title="Recolher">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedModule ? (
            <>
              <ul className="flex-1 overflow-y-auto divide-y max-h-[52vh]">
                {subgroups.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">Nenhum subgrupo.</li>
                )}
                {subgroups.map((sg) => {
                  const active = sg.id === subgroupId;
                  const isCustom = !!ct.scopedOverrides?.customSubgroups?.[selectedModule.id]?.some((s) => s.id === sg.id);
                  return (
                    <li key={sg.id}>
                      <div className={`flex items-stretch ${active ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-secondary/50"}`}>
                        <button onClick={() => setSubgroupId(sg.id)} className="flex-1 text-left px-3 py-2 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate flex-1">{sg.title}</span>
                            {isCustom && <Badge className="text-[9px] py-0 h-4">Local</Badge>}
                            <Badge variant="secondary" className="text-[10px]">{sg.fields.length}</Badge>
                          </div>
                        </button>
                        <button
                          onClick={() => deleteSubgroup(sg.id)}
                          title={isCustom ? "Remover" : "Ocultar neste tipo"}
                          className="px-2 text-muted-foreground hover:text-destructive"
                        >
                          {isCustom ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <HiddenSubgroupsBar typeId={ct.id} moduleId={selectedModule.id} />
              <div className="border-t p-2 bg-muted/20">
                <NewItemRow open={newSubgroupOpen} setOpen={setNewSubgroupOpen} onCreate={addSubgroup} cta="Adicionar subgrupo" placeholder="Nome do subgrupo" />
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">Selecione um módulo</div>
          )}
        </Card>
        )}

        {/* Coluna 4 — Campos */}
        {collapsed.fields ? (
          <CollapsedRail label="Campos / Perguntas" count={selectedSub?.fields.length ?? 0} icon={Pencil} onExpand={() => toggleCol("fields")} />
        ) : (
        <Card className="flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Campos / Perguntas</span>
            <Badge variant="outline" className="ml-auto text-[10px]">{selectedSub?.fields.length ?? 0}</Badge>
            <button onClick={() => toggleCol("fields")} className="text-muted-foreground hover:text-foreground" title="Recolher">
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
          {selectedSub && selectedModule ? (
            <>
              <ul className="flex-1 overflow-y-auto divide-y max-h-[52vh]">
                {selectedSub.fields.length === 0 && (
                  <li className="p-4 text-center text-xs text-muted-foreground">Nenhum campo neste subgrupo.</li>
                )}
                {selectedSub.fields.map((f) => {
                  const isCustom = !!ct.scopedOverrides?.customFields?.[`${selectedModule.id}.${selectedSub.id}`]?.some((cf) => cf.id === f.id);
                  return (
                    <li key={f.id} className="px-3 py-2 hover:bg-secondary/40 group flex items-center gap-2">
                      <button
                        onClick={() => setEditingField({ subgroupId: selectedSub.id, field: f, isCustom })}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate flex-1">{f.label}</span>
                          <Badge variant="outline" className="text-[10px]">{labelOfType(f.type)}</Badge>
                          {isCustom && <Badge className="text-[9px] py-0 h-4">Local</Badge>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">id: {f.id}{f.unit ? ` · ${f.unit}` : ""}</div>
                      </button>
                      <button
                        onClick={() => deleteField(selectedSub.id, f, isCustom)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        title={isCustom ? "Remover" : "Ocultar neste tipo"}
                      >
                        {isCustom ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <HiddenFieldsBar typeId={ct.id} moduleId={selectedModule.id} subgroupId={selectedSub.id} />
              <div className="border-t p-2 bg-muted/20">
                <NewFieldRow onCreate={(label) => addField(selectedSub.id, label)} />
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-xs text-muted-foreground">Selecione um subgrupo</div>
          )}
        </Card>
        )}
      </div>

      <ScopedFieldEditorSheet
        editing={editingField}
        typeId={ct.id}
        moduleId={selectedModule?.id}
        onClose={() => setEditingField(null)}
      />
    </AppShell>
  );
}

function CollapsedRail({
  label, count, icon: Icon, onExpand,
}: {
  label: string; count: number; icon: ComponentType<{ className?: string }>; onExpand: () => void;
}) {
  return (
    <Card
      className="flex flex-col items-center py-2 gap-2 cursor-pointer hover:bg-secondary/40 transition-colors"
      onClick={onExpand}
      title={`Expandir: ${label}`}
    >
      <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
      <Icon className="h-4 w-4 text-muted-foreground" />
      <Badge variant="outline" className="text-[10px] px-1.5">{count}</Badge>
      <div
        className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {label}
      </div>
    </Card>
  );
}

function labelOfType(t: FieldType) {
  return FIELD_TYPES.find((x) => x.value === t)?.label ?? t;
}

function NewItemRow({ open, setOpen, onCreate, cta, placeholder }: {
  open: boolean; setOpen: (v: boolean) => void; onCreate: (v: string) => void; cta: string; placeholder: string;
}) {
  const [v, setV] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {cta}
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
        placeholder={placeholder}
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
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onCreate(v); setV(""); } }}
        placeholder="Adicionar campo (Enter)"
        className="h-8 text-sm"
      />
      <Button size="sm" variant="outline" disabled={!v.trim()} onClick={() => { if (v.trim()) { onCreate(v); setV(""); } }}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function HiddenFieldsBar({ typeId, moduleId, subgroupId }: { typeId: string; moduleId: string; subgroupId: string }) {
  const ct = useCustomSurveyTypes().find((c) => c.id === typeId);
  const fields = ct?.scopedOverrides?.fields ?? {};
  const hidden = Object.entries(fields)
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
          onClick={() => { setTypeFieldPatch(typeId, moduleId, subgroupId, id, null); toast.success("Campo restaurado."); }}
          className="text-[11px] rounded border px-1.5 py-0.5 hover:bg-background"
          title="Restaurar"
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />{id}
        </button>
      ))}
    </div>
  );
}

function HiddenSubgroupsBar({ typeId, moduleId }: { typeId: string; moduleId: string }) {
  const ct = useCustomSurveyTypes().find((c) => c.id === typeId);
  const subs = ct?.scopedOverrides?.subgroups ?? {};
  const hidden = Object.entries(subs)
    .filter(([key, p]) => key.startsWith(`${moduleId}.`) && p.hidden)
    .map(([key]) => key.split(".").slice(1).join("."));
  if (!hidden.length) return null;
  return (
    <div className="border-t bg-muted/40 px-3 py-1.5 flex items-center gap-2 flex-wrap">
      <Eye className="h-3 w-3 text-muted-foreground" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Subgrupos ocultos:</span>
      {hidden.map((id) => (
        <button
          key={id}
          onClick={() => { setTypeSubgroupPatch(typeId, moduleId, id, null); toast.success("Subgrupo restaurado."); }}
          className="text-[11px] rounded border px-1.5 py-0.5 hover:bg-background"
          title="Restaurar"
        >
          <RotateCcw className="h-3 w-3 inline mr-1" />{id}
        </button>
      ))}
    </div>
  );
}

function ScopedFieldEditorSheet({
  editing, typeId, moduleId, onClose,
}: {
  editing: { subgroupId: string; field: FieldDef; isCustom: boolean } | null;
  typeId: string;
  moduleId?: string;
  onClose: () => void;
}) {
  const ct = useCustomSurveyTypes().find((c) => c.id === typeId);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [unit, setUnit] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [multi, setMulti] = useState(false);
  const [allowOther, setAllowOther] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [acceptsNote, setAcceptsNote] = useState(false);
  const [acceptsPhoto, setAcceptsPhoto] = useState(false);
  const [canBePending, setCanBePending] = useState(false);
  const [inReport, setInReport] = useState(true);

  useEffect(() => {
    if (!editing || !moduleId || !ct) return;
    const key = `${moduleId}.${editing.subgroupId}.${editing.field.id}`;
    const patch = ct.scopedOverrides?.fields?.[key];
    const merged = { ...editing.field, ...patch } as FieldDef & FieldPatch;
    setLabel(merged.label ?? "");
    setType((merged.type as FieldType) ?? "text");
    setUnit(merged.unit ?? "");
    setPlaceholder(merged.placeholder ?? "");
    setOptionsText((merged.options ?? []).join("\n"));
    setMulti(!!merged.multi);
    setAllowOther(!!merged.allowOther);
    setHidden(!!patch?.hidden);
    setAcceptsNote(!!patch?.acceptsNote);
    setAcceptsPhoto(!!patch?.acceptsPhoto);
    setCanBePending(!!patch?.canBePending);
    setInReport(patch?.inReport !== false);
  }, [editing, moduleId, ct]);

  if (!editing || !moduleId || !ct) return null;
  const showOptions = type === "select" || type === "multiselect" || type === "button-select";

  function save() {
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
      acceptsNote: acceptsNote || undefined,
      acceptsPhoto: acceptsPhoto || undefined,
      canBePending: canBePending || undefined,
      inReport: inReport ? undefined : false,
    };
    setTypeFieldPatch(typeId, moduleId!, editing!.subgroupId, editing!.field.id, patch);
    toast.success("Campo atualizado neste tipo.");
    onClose();
  }

  function reset() {
    setTypeFieldPatch(typeId, moduleId!, editing!.subgroupId, editing!.field.id, null);
    toast.success("Personalização local removida.");
    onClose();
  }

  return (
    <Sheet open={!!editing} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar campo (escopado)</SheetTitle>
          <SheetDescription>
            ID: <code className="text-xs">{editing.field.id}</code>{editing.isCustom && " · Local"}
          </SheetDescription>
        </SheetHeader>

        <div className="rounded-md border p-2 text-[11px] mt-3 bg-warn-soft border-warn/30">
          Mudanças aqui afetam <span className="font-medium">apenas este tipo</span>.
        </div>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Rótulo</Label>
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
              <Label className="text-xs">Unidade</Label>
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

          <div className="border-t pt-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Comportamento</p>
            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Aceita observação</Label>
              <Switch checked={acceptsNote} onCheckedChange={(v) => setAcceptsNote(!!v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Aceita foto</Label>
              <Switch checked={acceptsPhoto} onCheckedChange={(v) => setAcceptsPhoto(!!v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Pode ficar pendente</Label>
              <Switch checked={canBePending} onCheckedChange={(v) => setCanBePending(!!v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs cursor-pointer">Aparece em relatório</Label>
              <Switch checked={inReport} onCheckedChange={(v) => setInReport(!!v)} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <Label className="text-xs cursor-pointer text-destructive">Ocultar neste tipo</Label>
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

const COLOR_PRESETS = [
  "oklch(0.72 0.15 30)", "oklch(0.72 0.14 60)", "oklch(0.74 0.14 110)",
  "oklch(0.70 0.14 150)", "oklch(0.70 0.13 195)", "oklch(0.66 0.14 235)",
  "oklch(0.62 0.16 270)", "oklch(0.66 0.18 305)", "oklch(0.70 0.17 340)",
  "oklch(0.66 0.10 20)",
];

function IconColorPicker({
  color, iconName, onChange,
}: {
  color: string;
  iconName?: string;
  onChange: (patch: { color?: string; icon?: string }) => void;
}) {
  const Icon = getTypeIcon(iconName);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Mudar ícone e cor"
          className="inline-flex h-12 w-12 items-center justify-center rounded-md shadow-sm hover:opacity-90 transition-opacity"
          style={{ backgroundColor: color, color: "white" }}
        >
          <Icon className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-3" align="start">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 inline-flex items-center gap-1">
            <Palette className="h-3 w-3" /> Cor
          </p>
          <div className="grid grid-cols-10 gap-1">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                className={`h-5 w-5 rounded-sm border ${color === c ? "ring-2 ring-primary" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ícone</p>
          <div className="grid grid-cols-8 gap-1">
            {TYPE_ICON_OPTIONS.map(({ name, icon: I }) => {
              const active = iconName === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onChange({ icon: name })}
                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${active ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-foreground"}`}
                  title={name}
                >
                  <I className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
