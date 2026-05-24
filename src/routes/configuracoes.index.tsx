import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useDBSelector,
  addTemplate,
  updateTemplate,
  removeTemplate,
  setTemplateDefault,
  duplicateTemplate,
  resetOperationalData,
} from "@/lib/store";
import {
  SURVEY_TYPES,
  MODULE_PURPOSE_LABELS,
  type SurveyType,
  type SurveyTemplate,
  type ModulePurpose,
} from "@/lib/types";
import { FACTORY_TEMPLATES, MODULE_PRESETS, getModulesForType } from "@/lib/modules";
import {
  Star, Pencil, Trash2, Copy, Plus, ChevronDown, ChevronRight,
  Check, Search, Sparkles, FileStack, Eraser, RotateCcw, MoreVertical,
  LayoutTemplate, Filter, Layers, ListTree, Library, Compass, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { TiposLevantamentoTab } from "@/components/configuracoes/TiposLevantamentoTab";
import { BibliotecaModulosTab } from "@/components/configuracoes/BibliotecaModulosTab";
import { EstruturaFormulariosTab } from "@/components/configuracoes/EstruturaFormulariosTab";
import { BuscaGlobalTab } from "@/components/configuracoes/BuscaGlobalTab";
import { useDB } from "@/lib/store";

export const Route = createFileRoute("/configuracoes/")({
  head: () => ({
    meta: [
      { title: "Configurações — Templates de Levantamento" },
      { name: "description", content: "Crie e organize templates de módulos por tipo de levantamento." },
    ],
  }),
  component: ConfiguracoesPage,
});

type EditorState = {
  open: boolean;
  type: SurveyType;
  template?: SurveyTemplate;
};

function ConfiguracoesPage() {
  const [tab, setTab] = useState<string>("estrutura");
  const [structureFocus, setStructureFocus] = useState<string | undefined>(undefined);
  const db = useDB();
  const [seeding, setSeeding] = useState(false);
  // hasDemoData é leve mas vive em demoSeed (que importa muita coisa).
  // Calculamos localmente para não puxar o módulo no bundle inicial.
  const alreadySeeded = (db.clients ?? []).some((c) => c.name === "AgroRação Norte Ltda.");

  async function runSeed() {
    setSeeding(true);
    try {
      const { seedDemoData } = await import("@/lib/demoSeed");
      const r = await seedDemoData();
      toast.success(`Dados de demonstração criados: ${r.created} levantamentos.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar dados de demonstração.");
    } finally {
      setSeeding(false);
    }
  }

  function openStructure(moduleId: string) {
    setStructureFocus(moduleId);
    setTab("estrutura");
  }

  return (
    <AppShell>
      <header className="mb-5 space-y-1">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Administre tipos de levantamento, módulos, subgrupos, campos/perguntas e templates.
            </p>
          </div>
          <Button
            variant={alreadySeeded ? "outline" : "default"}
            size="sm"
            onClick={runSeed}
            disabled={seeding}
            title="Cria 6 clientes fictícios com levantamentos completamente preenchidos para demonstração."
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {seeding ? "Gerando…" : alreadySeeded ? "Gerar dados de demonstração novamente" : "Gerar dados de demonstração"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/5">
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                Resetar dados operacionais
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar clientes e levantamentos atuais?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acao remove clientes, empreendimentos, projetos, levantamentos e snapshots offline, mas preserva tipos,
                  modulos, templates e configuracoes da plataforma.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    resetOperationalData();
                    toast.success("Dados operacionais resetados.");
                  }}
                >
                  Resetar agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="estrutura"><Layers className="h-3.5 w-3.5 mr-1.5" /> Estrutura dos formulários</TabsTrigger>
          <TabsTrigger value="tipos"><ListTree className="h-3.5 w-3.5 mr-1.5" /> Tipos de levantamento</TabsTrigger>
          <TabsTrigger value="biblioteca"><Library className="h-3.5 w-3.5 mr-1.5" /> Biblioteca de módulos</TabsTrigger>
          <TabsTrigger value="templates"><LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Templates</TabsTrigger>
          <TabsTrigger value="busca"><Compass className="h-3.5 w-3.5 mr-1.5" /> Busca global</TabsTrigger>
        </TabsList>

        <TabsContent value="estrutura" className="mt-0">
          <EstruturaFormulariosTab
            initialModuleId={structureFocus}
            onConsumed={() => setStructureFocus(undefined)}
          />
        </TabsContent>

        <TabsContent value="tipos" className="mt-0">
          <TiposLevantamentoTab />
        </TabsContent>

        <TabsContent value="biblioteca" className="mt-0">
          <BibliotecaModulosTab onOpenStructure={openStructure} />
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="busca" className="mt-0">
          <BuscaGlobalTab onOpen={openStructure} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function TemplatesTab() {
  const templates = useDBSelector((s) => s.templates ?? [], (a, b) => a === b);
  const [activeType, setActiveType] = useState<SurveyType>("geral");
  const [editor, setEditor] = useState<EditorState>({ open: false, type: "geral" });
  const [query, setQuery] = useState("");

  const userTemplates = templates.filter((t) => t.type === activeType);
  const factoryTemplates = FACTORY_TEMPLATES.filter((t) => t.type === activeType);
  const modulesOfType = getModulesForType(activeType);

  const filteredUser = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userTemplates;
    return userTemplates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [userTemplates, query]);

  function openBlank() {
    setEditor({ open: true, type: activeType, template: undefined });
  }
  function openFromPreset(kind: "all" | "minimal") {
    const preset = MODULE_PRESETS[activeType];
    const ids = preset[kind] ?? preset.all;
    const draft: SurveyTemplate = {
      id: "draft",
      name: kind === "all" ? "Novo (todos os módulos)" : "Novo (mínimo)",
      type: activeType,
      moduleIds: [...ids],
      createdAt: new Date().toISOString(),
    };
    setEditor({ open: true, type: activeType, template: draft });
  }
  function openFromFactory(f: typeof FACTORY_TEMPLATES[number]) {
    const draft: SurveyTemplate = {
      id: "draft",
      name: `${f.name} (cópia)`,
      type: f.type,
      moduleIds: [...f.moduleIds],
      createdAt: new Date().toISOString(),
    };
    setEditor({ open: true, type: f.type, template: draft });
  }
  function openFromUser(tpl: SurveyTemplate) {
    setEditor({ open: true, type: tpl.type, template: tpl });
  }
  function handleDuplicate(tpl: SurveyTemplate) {
    duplicateTemplate(tpl.id);
    toast.success("Template duplicado.");
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
        Templates são combinações prontas de módulos e subgrupos. A criação e edição estrutural
        de campos acontece em <span className="font-medium text-foreground">Estrutura dos formulários</span>.
      </p>

      {/* Type chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        {SURVEY_TYPES.map((t) => {
          const active = t.id === activeType;
          const userCount = templates.filter((x) => x.type === t.id).length;
          const factoryCount = FACTORY_TEMPLATES.filter((x) => x.type === t.id).length;
          return (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              className={`group rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              {t.label}
              <span
                className={`ml-2 text-[10px] rounded-full px-1.5 py-0.5 ${
                  active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                }`}
              >
                {userCount + factoryCount}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground -mt-2 mb-4">
        {SURVEY_TYPES.find((t) => t.id === activeType)?.description}
      </p>

      {/* Quick-create bar */}
      <Card className="mb-5 border-dashed">
        <CardContent className="flex flex-wrap items-center gap-2 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium mr-2">Criar template</span>
          <Button size="sm" onClick={openBlank}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Em branco
          </Button>
          <Button size="sm" variant="outline" onClick={() => openFromPreset("all")}>
            <FileStack className="h-3.5 w-3.5 mr-1" /> Todos os módulos
          </Button>
          <Button size="sm" variant="outline" onClick={() => openFromPreset("minimal")}>
            <LayoutTemplate className="h-3.5 w-3.5 mr-1" /> Mínimo
          </Button>
          {factoryTemplates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Clonar de fábrica
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-xs">
                <DropdownMenuLabel>Templates de fábrica</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {factoryTemplates.map((f) => (
                  <DropdownMenuItem key={f.id} onClick={() => openFromFactory(f)}>
                    <div className="flex flex-col">
                      <span className="text-sm">{f.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {f.moduleIds.length} módulos
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {userTemplates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar existente
                  <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-w-xs">
                <DropdownMenuLabel>Seus templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userTemplates.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => handleDuplicate(t)}>
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-auto relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar template…"
              className="pl-7 h-8 w-56"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Templates list */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Seus templates
          </h2>
          {filteredUser.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {userTemplates.length === 0
                    ? "Você ainda não criou um template para este tipo."
                    : "Nenhum template corresponde à busca."}
                </p>
                {userTemplates.length === 0 && (
                  <Button size="sm" className="mt-3" onClick={openBlank}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro template
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {filteredUser.map((tpl) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => openFromUser(tpl)}
              onDuplicate={() => handleDuplicate(tpl)}
              onSetDefault={(v) => setTemplateDefault(tpl.id, v)}
              onRemove={() => removeTemplate(tpl.id)}
              onRename={(name) => updateTemplate(tpl.id, { name })}
            />
          ))}

          {factoryTemplates.length > 0 && (
            <>
              <Separator className="my-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                De fábrica
              </h2>
              {factoryTemplates.map((f) => (
                <Card key={f.id} className="border-dashed">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {f.name}
                        <Badge variant="secondary" className="text-[10px]">Fábrica</Badge>
                      </div>
                      <ModuleChips ids={f.moduleIds} type={activeType} max={6} />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openFromFactory(f)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Clonar e editar
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>

        {/* Right rail: modules catalog */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Catálogo de módulos</CardTitle>
            <p className="text-xs text-muted-foreground">
              {modulesOfType.length} módulos disponíveis para este tipo
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {modulesOfType.map((m) => (
                <li key={m.id} className="text-sm">
                  <div className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{m.title}</div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {m.subgroups && m.subgroups.length > 0 && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {m.subgroups.length} subgrupo(s)
                          </Badge>
                        )}
                        {(m.purposes ?? []).map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px] py-0 h-4">
                            {MODULE_PURPOSE_LABELS[p]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <TemplateEditor
        key={`${editor.template?.id ?? "new"}-${editor.type}-${editor.open}`}
        state={editor}
        onClose={() => setEditor((s) => ({ ...s, open: false }))}
      />
    </>
  );
}

/* ------------ Template card ------------ */

function TemplateCard({
  template, onEdit, onDuplicate, onSetDefault, onRemove, onRename,
}: {
  template: SurveyTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onSetDefault: (v: boolean) => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(template.name);
  useEffect(() => setName(template.name), [template.name]);

  const overrides = template.subgroupOverrides ?? {};
  const overrideCount = Object.values(overrides).reduce((acc, arr) => acc + arr.length, 0);

  function commit() {
    setEditingName(false);
    const v = name.trim();
    if (v && v !== template.name) {
      onRename(v);
      toast.success("Nome atualizado.");
    } else {
      setName(template.name);
    }
  }

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {editingName ? (
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") { setName(template.name); setEditingName(false); }
                  }}
                  className="h-7 max-w-xs text-sm"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="font-medium text-sm hover:underline decoration-dotted underline-offset-2 text-left"
                  title="Renomear"
                >
                  {template.name}
                </button>
              )}
              {template.isDefault && (
                <Badge className="text-[10px] gap-1">
                  <Star className="h-3 w-3 fill-current" /> Padrão
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            )}
            <ModuleChips ids={template.moduleIds} type={template.type} max={6} />
            <p className="text-[11px] text-muted-foreground mt-1">
              {template.moduleIds.length} módulos
              {overrideCount > 0 && ` • ${overrideCount} subgrupo(s) ocultos`}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 mr-1">
              <Switch
                id={`def-${template.id}`}
                checked={!!template.isDefault}
                onCheckedChange={(v) => onSetDefault(!!v)}
              />
              <Label htmlFor={`def-${template.id}`} className="text-xs cursor-pointer">
                Padrão
              </Label>
            </div>
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingName(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Renomear
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      onSelect={(e) => e.preventDefault()}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover template</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Levantamentos já criados não são afetados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onRemove}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------ Module chips preview ------------ */

function ModuleChips({ ids, type, max = 5 }: { ids: string[]; type: SurveyType; max?: number }) {
  const all = getModulesForType(type);
  const titleOf = (id: string) => all.find((m) => m.id === id)?.title ?? id;
  const visible = ids.slice(0, max);
  const rest = ids.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {visible.map((id) => (
        <Badge key={id} variant="outline" className="text-[10px] py-0 h-5 font-normal">
          {titleOf(id)}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge variant="secondary" className="text-[10px] py-0 h-5 font-normal">
          +{rest}
        </Badge>
      )}
    </div>
  );
}

/* ------------ Editor ------------ */

const ALL_PURPOSES: ModulePurpose[] = ["projeto", "acompanhamento", "monitoramento", "outorga", "vazao"];

function TemplateEditor({ state, onClose }: { state: EditorState; onClose: () => void }) {
  const isEditingExisting = !!state.template && state.template.id !== "draft";
  const initial = state.template;

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isDefault, setIsDefault] = useState(!!initial?.isDefault);

  const allModules = getModulesForType(state.type);
  const presetAll = MODULE_PRESETS[state.type].all;
  const presetMin = MODULE_PRESETS[state.type].minimal;

  const initialIds = useMemo(() => new Set(initial?.moduleIds ?? presetAll), [initial, presetAll]);
  const [moduleIds, setModuleIds] = useState<Set<string>>(initialIds);

  const [overrides, setOverrides] = useState<Record<string, Set<string>>>(() => {
    const out: Record<string, Set<string>> = {};
    const o = initial?.subgroupOverrides ?? {};
    for (const k of Object.keys(o)) out[k] = new Set(o[k]);
    return out;
  });

  const [openModules, setOpenModules] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<Set<ModulePurpose>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModules.filter((m) => {
      if (q && !m.title.toLowerCase().includes(q) && !(m.description ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (purposeFilter.size > 0) {
        const ps = m.purposes ?? [];
        if (!ps.some((p) => purposeFilter.has(p))) return false;
      }
      return true;
    });
  }, [allModules, search, purposeFilter]);

  function toggleModule(id: string) {
    setModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSubgroup(modId: string, sgId: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      const cur = new Set(next[modId] ?? []);
      if (cur.has(sgId)) cur.delete(sgId);
      else cur.add(sgId);
      if (cur.size === 0) delete next[modId];
      else next[modId] = cur;
      return next;
    });
  }
  function toggleOpen(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function togglePurpose(p: ModulePurpose) {
    setPurposeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }
  function selectAllVisible() {
    setModuleIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((m) => next.add(m.id));
      return next;
    });
  }
  function clearAllVisible() {
    setModuleIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((m) => next.delete(m.id));
      return next;
    });
  }
  function applyPreset(kind: "all" | "minimal") {
    setModuleIds(new Set(kind === "all" ? presetAll : presetMin));
    setOverrides({});
  }

  function handleSave() {
    if (!name.trim()) return toast.error("Informe o nome do template.");
    if (moduleIds.size === 0) return toast.error("Selecione ao menos um módulo.");

    const subOv: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(overrides)) {
      if (v.size > 0 && moduleIds.has(k)) subOv[k] = Array.from(v);
    }
    const orderedIds = presetAll.filter((id) => moduleIds.has(id));
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      type: state.type,
      moduleIds: orderedIds,
      subgroupOverrides: Object.keys(subOv).length ? subOv : undefined,
    };

    if (isEditingExisting && initial) {
      updateTemplate(initial.id, payload);
      if (isDefault !== !!initial.isDefault) setTemplateDefault(initial.id, isDefault);
      toast.success("Template atualizado.");
    } else {
      const created = addTemplate({ ...payload, isDefault: false });
      if (isDefault) setTemplateDefault(created.id, true);
      toast.success("Template criado.");
    }
    onClose();
  }

  const selectedOrdered = presetAll.filter((id) => moduleIds.has(id));

  return (
    <Dialog open={state.open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>{isEditingExisting ? "Editar template" : "Novo template"}</DialogTitle>
          <DialogDescription>
            Selecione os módulos e subgrupos. Subgrupos desmarcados são pré-marcados como
            "Não se aplica" em novos levantamentos.
          </DialogDescription>
        </DialogHeader>

        {/* Meta row */}
        <div className="px-6 py-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] border-b">
          <div className="grid gap-1">
            <Label htmlFor="tpl-name" className="text-xs">Nome</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Visita inicial completa"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="tpl-desc" className="text-xs">Descrição (opcional)</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={1}
              placeholder="Quando usar este template…"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 h-10">
              <Switch id="tpl-def" checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
              <Label htmlFor="tpl-def" className="cursor-pointer text-xs">Padrão</Label>
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex-1 overflow-hidden grid md:grid-cols-[1.4fr_1fr]">
          {/* Left: module picker */}
          <div className="border-r flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b space-y-2 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar módulo…"
                    className="pl-7 h-8"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8">
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Preset
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => applyPreset("all")}>
                      Todos os módulos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => applyPreset("minimal")}>
                      Conjunto mínimo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3 w-3 text-muted-foreground" />
                {ALL_PURPOSES.map((p) => {
                  const active = purposeFilter.has(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePurpose(p)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {MODULE_PURPOSE_LABELS[p]}
                    </button>
                  );
                })}
                <div className="ml-auto flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllVisible}>
                    <Check className="h-3 w-3 mr-1" /> Marcar visíveis
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearAllVisible}>
                    <Eraser className="h-3 w-3 mr-1" /> Limpar visíveis
                  </Button>
                </div>
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto divide-y">
              {filtered.length === 0 && (
                <li className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum módulo corresponde ao filtro.
                </li>
              )}
              {filtered.map((m) => {
                const checked = moduleIds.has(m.id);
                const subgroups = m.subgroups ?? [];
                const isOpen = openModules.has(m.id);
                const disabledSubs = overrides[m.id] ?? new Set<string>();
                const visibleSubCount = subgroups.length - disabledSubs.size;
                return (
                  <li key={m.id} className={`px-4 py-2 ${checked ? "" : "opacity-70"}`}>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id={`mod-${m.id}`}
                        checked={checked}
                        onCheckedChange={() => toggleModule(m.id)}
                        className="mt-0.5"
                      />
                      <Label htmlFor={`mod-${m.id}`} className="flex-1 cursor-pointer min-w-0">
                        <div className="text-sm font-medium leading-tight">{m.title}</div>
                        {m.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(m.purposes ?? []).map((p) => (
                            <Badge key={p} variant="secondary" className="text-[9px] py-0 h-4 font-normal">
                              {MODULE_PURPOSE_LABELS[p]}
                            </Badge>
                          ))}
                        </div>
                      </Label>
                      {subgroups.length > 0 && checked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleOpen(m.id)}
                          className="h-7 shrink-0"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="ml-1 text-[11px]">
                            {visibleSubCount}/{subgroups.length}
                          </span>
                        </Button>
                      )}
                    </div>
                    {isOpen && checked && subgroups.length > 0 && (
                      <ul className="mt-2 ml-6 grid gap-1.5 pl-2 border-l">
                        {subgroups.map((sg) => {
                          const sgChecked = !disabledSubs.has(sg.id);
                          return (
                            <li key={sg.id} className="flex items-start gap-2">
                              <Checkbox
                                id={`sg-${m.id}-${sg.id}`}
                                checked={sgChecked}
                                onCheckedChange={() => toggleSubgroup(m.id, sg.id)}
                                className="mt-0.5"
                              />
                              <Label htmlFor={`sg-${m.id}-${sg.id}`} className="cursor-pointer text-xs">
                                <span className="font-medium">{sg.title}</span>
                                {sg.description && (
                                  <span className="block text-muted-foreground">{sg.description}</span>
                                )}
                              </Label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: live summary */}
          <div className="flex flex-col overflow-hidden bg-muted/20">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  No template
                </span>
                <Badge variant="outline">
                  {moduleIds.size} de {allModules.length}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Ordem segue a sequência canônica do tipo.
              </p>
            </div>
            <ol className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {selectedOrdered.length === 0 && (
                <li className="text-xs text-muted-foreground italic">
                  Selecione módulos à esquerda para começar.
                </li>
              )}
              {selectedOrdered.map((id, i) => {
                const m = allModules.find((x) => x.id === id);
                if (!m) return null;
                const dis = overrides[id]?.size ?? 0;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 group"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-tight truncate">{m.title}</div>
                      {dis > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {dis} subgrupo(s) ocultos
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => toggleModule(id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      title="Remover do template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-background">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" /> Salvar template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
