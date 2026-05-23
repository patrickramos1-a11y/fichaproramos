import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useCustomSurveyTypes,
  createCustomSurveyType,
  deleteCustomSurveyType,
  duplicateCustomSurveyType,
  updateCustomSurveyType,
  useEffectiveModulesForCustomTypeId,
} from "@/lib/store";
import { MODULES } from "@/lib/modules";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { autoColor } from "@/lib/colors";
import { getTypeIcon, TYPE_ICON_OPTIONS } from "@/lib/typeIcons";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChevronRight, Layers, ListTree, FileText, Plus, Pencil, Copy, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const COLOR_PRESETS = [
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#64748b", "#eab308", "#6366f1",
];

export function TiposLevantamentoTab() {
  const types = useCustomSurveyTypes().filter((c) => !c.archivedAt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  // Mantém uma seleção válida quando a lista muda.
  useEffect(() => {
    if (!types.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !types.find((t) => t.id === selectedId)) {
      setSelectedId(types[0].id);
    }
  }, [types, selectedId]);

  return (
    <div className="space-y-4">
      {/* Header / CTA */}
      <Card className="border-dashed">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <Layers className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Tipos de levantamento</div>
            <p className="text-xs text-muted-foreground">
              Cada tipo define um conjunto próprio de módulos, subgrupos e campos.
              Edite, duplique ou remova livremente — todos seguem a mesma estrutura.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Criar novo tipo
          </Button>
        </CardContent>
      </Card>

      <CreateTypeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id, openBuilder) => {
          setSelectedId(id);
          if (openBuilder) {
            navigate({ to: "/configuracoes/tipos/$typeId", params: { typeId: id } });
          }
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Coluna 1 — Lista única de tipos */}
        <Card className="h-fit">
          <CardContent className="p-2">
            <ul className="space-y-0.5">
              {types.length === 0 && (
                <li className="px-2.5 py-2 text-[11px] text-muted-foreground">
                  Nenhum tipo cadastrado.
                </li>
              )}
              {types.map((c) => {
                const Icon = getTypeIcon(c.icon);
                const color = c.color ?? autoColor(c.id);
                const isActive = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-md px-2.5 py-2 transition-colors ${
                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md shrink-0"
                          style={{ backgroundColor: color, color: "white", opacity: c.inactive ? 0.5 : 1 }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className={`text-sm font-medium leading-tight truncate flex-1 ${c.inactive ? "opacity-60" : ""}`}>
                          {c.label}
                        </span>
                        {c.inactive && (
                          <Badge variant="outline" className="text-[9px] shrink-0">Inativo</Badge>
                        )}
                        <Badge
                          variant={isActive ? "secondary" : "outline"}
                          className="text-[10px] shrink-0"
                        >
                          {c.moduleBindings.length}
                        </Badge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Coluna 2 — Detalhes */}
        <div className="space-y-3">
          {selectedId
            ? <TypeDetail typeId={selectedId} />
            : <div className="text-sm text-muted-foreground">Selecione um tipo na lista.</div>}
        </div>
      </div>
    </div>
  );
}

function CreateTypeDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string, openBuilder: boolean) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [icon, setIcon] = useState<string>("Layers");
  const [active, setActive] = useState(true);

  function reset() {
    setLabel(""); setDescription(""); setColor(COLOR_PRESETS[0]);
    setIcon("Layers"); setActive(true);
  }

  function submit(openBuilder: boolean) {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Informe o nome do tipo.");
      return;
    }
    const ct = createCustomSurveyType({
      label: trimmed,
      description: description.trim() || undefined,
      color, icon,
    });
    if (!active) updateCustomSurveyType(ct.id, { inactive: true });
    toast.success("Tipo criado.");
    reset();
    onOpenChange(false);
    onCreated(ct.id, openBuilder);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar novo tipo de levantamento</DialogTitle>
          <DialogDescription>
            Defina nome, identidade visual e estado. Você poderá montar a estrutura de
            módulos no construtor logo em seguida.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ct-label">Nome *</Label>
            <Input
              id="ct-label"
              autoFocus
              value={label}
              placeholder="Ex.: Auditoria Ambiental"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ct-desc">Descrição</Label>
            <Textarea
              id="ct-desc"
              rows={2}
              value={description}
              placeholder="Para que serve este tipo de levantamento?"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-md border-2 transition-transform ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-7 w-7 rounded-md border bg-background cursor-pointer"
                aria-label="Cor personalizada"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Ícone</Label>
            <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1 border rounded-md">
              {TYPE_ICON_OPTIONS.map(({ name, icon: I }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setIcon(name)}
                  className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors ${
                    icon === name ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                  title={name}
                >
                  <I className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Ativo</div>
              <p className="text-xs text-muted-foreground">
                Tipos inativos não aparecem ao criar novos levantamentos.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={!label.trim()}>
            Criar
          </Button>
          <Button onClick={() => submit(true)} disabled={!label.trim()}>
            Criar e abrir construtor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeDetail({ typeId }: { typeId: string }) {
  const types = useCustomSurveyTypes();
  const ct = types.find((c) => c.id === typeId);
  const navigate = useNavigate();
  if (!ct) {
    return <div className="text-sm text-muted-foreground">Tipo não encontrado.</div>;
  }
  const Icon = getTypeIcon(ct.icon);
  const color = ct.color ?? autoColor(ct.id);
  const effectiveModules = useEffectiveModulesForCustomTypeId(ct.id);
  const linkedModules = ct.moduleBindings
    .map((b) => effectiveModules.find((m) => m.id === b.moduleId) ?? MODULES.find((m) => m.id === b.moduleId))
    .filter(Boolean) as typeof MODULES;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-md shrink-0"
            style={{ backgroundColor: color, color: "white" }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold truncate">{ct.label}</h3>
              {ct.inactive && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
            </div>
            {ct.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{ct.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-md border px-3">
            <span className="text-xs text-muted-foreground">{ct.inactive ? "Inativo" : "Ativo"}</span>
            <Switch
              checked={!ct.inactive}
              onCheckedChange={(v) => {
                updateCustomSurveyType(ct.id, { inactive: !v });
                toast.success(v ? "Tipo ativado." : "Tipo desativado.");
              }}
            />
          </div>
          <Button asChild size="sm">
            <Link to="/configuracoes/tipos/$typeId" params={{ typeId: ct.id }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar tipo
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const c = duplicateCustomSurveyType(ct.id);
              if (c) toast.success("Tipo duplicado.");
            }}
          >
            <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir tipo de levantamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se houver levantamentos vinculados a este tipo, ele será arquivado em vez de
                  excluído permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteCustomSurveyType(ct.id);
                    toast.success("Tipo removido.");
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {linkedModules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Este tipo ainda não tem módulos vinculados.
            </p>
            <Button asChild size="sm">
              <Link to="/configuracoes/tipos/$typeId" params={{ typeId: ct.id }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Abrir construtor
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ModuleListReadonly
          modules={linkedModules}
          onOpen={() => navigate({ to: "/configuracoes/tipos/$typeId", params: { typeId: ct.id } })}
        />
      )}
    </>
  );
}

function ModuleListReadonly({
  modules, onOpen,
}: {
  modules: typeof MODULES;
  onOpen: () => void;
}) {
  return (
    <div className="grid gap-2">
      {modules.map((m, idx) => {
        const subs = m.subgroups?.length ?? 0;
        const fields = (m.fields?.length ?? 0)
          + (m.subgroups ?? []).reduce((acc, s) => acc + s.fields.length, 0);
        return (
          <Card key={m.id} className="hover:border-primary/40 transition-colors">
            <CardContent className="py-3 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-mono text-muted-foreground w-6">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.title}</div>
                {m.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                )}
                <div className="flex gap-3 text-[11px] text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1">
                    <ListTree className="h-3 w-3" /> {subs} subgrupo(s)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {fields} campo(s)
                  </span>
                </div>
              </div>
              <button
                onClick={onOpen}
                className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Layers className="h-3.5 w-3.5" /> Ver estrutura
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
