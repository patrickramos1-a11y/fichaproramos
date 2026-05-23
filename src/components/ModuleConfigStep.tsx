import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getModulesForType, MODULE_PRESETS, FACTORY_TEMPLATES } from "@/lib/modules";
import type { SurveyType, ModulePurpose } from "@/lib/types";
import { MODULE_PURPOSE_LABELS } from "@/lib/types";
import { useDB, addTemplate, removeTemplate, setTemplateDefault } from "@/lib/store";
import { Trash2, Save, Star } from "lucide-react";

const REQUIRED = new Set(["identificacao", "validacao"]);

interface Props {
  surveyType: SurveyType;
  initial?: string[];
  onConfirm: (ids: string[]) => void;
}

export function ModuleConfigStep({ surveyType, initial, onConfirm }: Props) {
  const all = getModulesForType(surveyType);
  const presets = MODULE_PRESETS[surveyType];
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial && initial.length ? initial : presets.all),
  );
  const db = useDB();
  const templates = useMemo(() => (db.templates ?? []).filter((t) => t.type === surveyType), [db.templates, surveyType]);
  const factoryTemplates = useMemo(() => FACTORY_TEMPLATES.filter((t) => t.type === surveyType), [surveyType]);
  const [tplName, setTplName] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<ModulePurpose | null>(null);

  const allPurposes: ModulePurpose[] = useMemo(() => {
    const s = new Set<ModulePurpose>();
    all.forEach((m) => m.purposes?.forEach((p) => s.add(p)));
    return Array.from(s);
  }, [all]);

  const visibleModules = useMemo(() => {
    if (!purposeFilter) return all;
    return all.filter((m) => REQUIRED.has(m.id) || (m.purposes ?? []).includes(purposeFilter));
  }, [all, purposeFilter]);

  function toggle(id: string) {
    if (REQUIRED.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function applyPreset(ids: string[]) {
    const next = new Set(ids);
    REQUIRED.forEach((r) => next.add(r));
    setSelected(next);
  }

  function saveAsTemplate() {
    const name = tplName.trim();
    if (!name) return;
    addTemplate({ name, type: surveyType, moduleIds: Array.from(selected) });
    setTplName("");
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-1">Configurar módulos do levantamento</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha quais módulos serão usados neste levantamento. Você pode alterar essa seleção depois.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => applyPreset(presets.all)}>Usar todos</Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset(presets.minimal)}>Preset essencial</Button>
          <Button variant="ghost" size="sm" onClick={() => applyPreset([])}>Limpar</Button>
        </div>

        {factoryTemplates.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Templates de fábrica</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {factoryTemplates.map((t) => (
                <button key={t.id} type="button" onClick={() => applyPreset(t.moduleIds)}
                  className="text-xs rounded-full border border-border bg-secondary/40 px-3 py-1 hover:bg-secondary">
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {templates.length > 0 && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Templates salvos</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {templates.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 pl-3 pr-1 py-0.5 text-xs">
                  <button type="button" className="hover:underline" onClick={() => applyPreset(t.moduleIds)}>{t.name}</button>
                  <button type="button"
                    className="rounded-full p-1 hover:bg-secondary"
                    onClick={() => setTemplateDefault(t.id, !t.isDefault)}
                    aria-label={t.isDefault ? "Remover como padrão" : "Tornar padrão para este tipo"}
                    title={t.isDefault ? "Padrão para este tipo (clique para remover)" : "Tornar padrão para este tipo"}
                  >
                    <Star className="h-3 w-3" style={t.isDefault ? { color: "var(--status-progress)", fill: "currentColor" } : undefined} />
                  </button>
                  <button type="button" className="rounded-full p-1 hover:bg-secondary" onClick={() => removeTemplate(t.id)} aria-label="Remover template">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {allPurposes.length > 0 && (
          <div className="mb-3">
            <Label className="text-xs text-muted-foreground">Filtrar por finalidade</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setPurposeFilter(null)}
                className={`text-xs rounded-full px-2.5 py-1 border ${!purposeFilter ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>Todos</button>
              {allPurposes.map((p) => (
                <button type="button" key={p} onClick={() => setPurposeFilter(purposeFilter === p ? null : p)}
                  className={`text-xs rounded-full px-2.5 py-1 border ${purposeFilter === p ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}>
                  {MODULE_PURPOSE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          {visibleModules.map((m) => {
            const required = REQUIRED.has(m.id);
            const checked = selected.has(m.id) || required;
            return (
              <label
                key={m.id}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(m.id)} disabled={required} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {m.title}
                    {required && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">obrigatório</span>}
                  </div>
                  {m.description && <div className="text-xs text-muted-foreground line-clamp-2">{m.description}</div>}
                  {m.purposes && m.purposes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.purposes.map((p) => (
                        <span key={p} className="text-[10px] rounded-full border border-border px-1.5 py-0 text-muted-foreground">
                          {MODULE_PURPOSE_LABELS[p]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">{selected.size} módulos selecionados</Label>
          <Button onClick={() => onConfirm(Array.from(selected))}>Iniciar preenchimento</Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Input
            placeholder="Nome para salvar como template"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            className="max-w-xs h-8"
          />
          <Button variant="outline" size="sm" onClick={saveAsTemplate} disabled={!tplName.trim()}>
            <Save className="h-3.5 w-3.5 mr-1" /> Salvar como template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
