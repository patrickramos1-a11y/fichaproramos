import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { FieldRenderer } from "@/components/FieldRenderer";
import { Button } from "@/components/ui/button";
import { useDBSelector, setFieldValue, setFieldStatus, setFieldNote, setFieldNA, setSubgroupNote, setSubgroupNA, setSubgroupDone } from "@/lib/store";
import { useEffectiveModulesForSurvey } from "@/lib/store";
import { shouldShowField } from "@/lib/modules";
import type { FieldDef, FieldStatus, ModuleState, SubgroupDef } from "@/lib/types";
import { Check, Ban } from "lucide-react";

export type QuickEditTarget =
  | { surveyId: string; moduleId: string; kind: "module" }
  | { surveyId: string; moduleId: string; kind: "subgroup"; subgroupId: string }
  | { surveyId: string; moduleId: string; kind: "field"; fieldId: string };

export function QuickEditDrawer({ target, onOpenChange }: { target: QuickEditTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const survey = useDBSelector(
    (s) => target ? s.surveys.find((x) => x.id === target.surveyId) ?? null : null,
    (a, b) => a === b,
  );
  const modules = useEffectiveModulesForSurvey(survey ?? ({ type: "geral", customTypeId: undefined } as any));

  const ctx = useMemo(() => {
    if (!target || !survey) return null;
    const mod = modules.find((m) => m.id === target.moduleId);
    if (!mod) return null;
    const state = survey.modules[mod.id] as ModuleState;
    let title = mod.title;
    let fields: FieldDef[] = [];
    let subgroup: SubgroupDef | null = null;
    if (target.kind === "field") {
      const f =
        mod.fields.find((x) => x.id === target.fieldId) ??
        mod.subgroups?.flatMap((sg) => sg.fields).find((x) => x.id === target.fieldId);
      if (f) {
        fields = [f];
        title = f.label;
      }
    } else if (target.kind === "subgroup") {
      const sg = mod.subgroups?.find((x) => x.id === target.subgroupId) ?? null;
      if (sg) {
        subgroup = sg;
        fields = sg.fields.filter((f) => shouldShowField(f, state.values));
        title = sg.title;
      }
    } else {
      fields = mod.fields.filter((f) => shouldShowField(f, state.values));
      title = mod.title;
    }
    return { mod, state, title, fields, subgroup };
  }, [target, survey, modules]);

  if (!target || !survey || !ctx) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto" />
      </Sheet>
    );
  }

  const { mod, state, title, fields, subgroup } = ctx;
  const closed = !!survey.closedAt;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mod.title}{subgroup ? ` · ${subgroup.title}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid gap-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem campos disponíveis neste contexto.</p>
          )}
          {fields.map((f) => (
            <FieldRenderer
              key={f.id}
              field={f}
              value={state.values[f.id]}
              status={(state.fieldStatus?.[f.id] as FieldStatus) || "nao_iniciado"}
              note={state.fieldNotes?.[f.id]}
              na={!!state.nonApplicable?.[f.id]}
              onChange={(v) => setFieldValue(survey.id, mod.id, f.id, v)}
              onStatus={(s) => setFieldStatus(survey.id, mod.id, f.id, s)}
              onNote={(n) => setFieldNote(survey.id, mod.id, f.id, n)}
              onNA={(na) => setFieldNA(survey.id, mod.id, f.id, na)}
              moduleValues={state.values}
            />
          ))}

          {subgroup && (
            <div className="mt-2 grid gap-2 border-t border-border pt-3">
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={2}
                placeholder="Observação do subgrupo…"
                value={state.subgroupNotes?.[subgroup.id] ?? ""}
                onChange={(e) => setSubgroupNote(survey.id, mod.id, subgroup.id, e.target.value)}
                disabled={closed}
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setSubgroupNA(survey.id, mod.id, subgroup.id, true)} disabled={closed}>
                  <Ban className="h-3.5 w-3.5 mr-1" /> Não se aplica
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSubgroupDone(survey.id, mod.id, subgroup.id, true)} disabled={closed} style={{ borderColor: "var(--status-done)", color: "var(--status-done)" }}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Concluir subgrupo
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}