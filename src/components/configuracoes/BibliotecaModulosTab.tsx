import { useMemo, useState } from "react";
import { MODULES, MODULES_BY_TYPE, getModulesForType } from "@/lib/modules";
import { SURVEY_TYPES, MODULE_PURPOSE_LABELS, type SurveyType } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Layers, ListTree, FileText, ChevronRight } from "lucide-react";

export function BibliotecaModulosTab({ onOpenStructure }: { onOpenStructure: (moduleId: string) => void }) {
  const [q, setQ] = useState("");

  const moduleUsage = useMemo(() => {
    const usage: Record<string, SurveyType[]> = {};
    for (const m of MODULES) usage[m.id] = [];
    for (const [type, ids] of Object.entries(MODULES_BY_TYPE) as [SurveyType, string[]][]) {
      for (const id of ids) usage[id]?.push(type);
    }
    return usage;
  }, []);

  // Pega catálogo "efetivo" (com overrides aplicados) de cada módulo via getModulesForType("geral") indexado.
  const effective = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getModulesForType>[number]>();
    for (const t of SURVEY_TYPES) {
      for (const m of getModulesForType(t.id)) if (!map.has(m.id)) map.set(m.id, m);
    }
    return map;
  }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return MODULES
      .map((base) => effective.get(base.id) ?? base)
      .filter((m) => {
        if (!term) return true;
        if (m.title.toLowerCase().includes(term)) return true;
        if ((m.description ?? "").toLowerCase().includes(term)) return true;
        for (const sg of m.subgroups ?? []) {
          if (sg.title.toLowerCase().includes(term)) return true;
          for (const f of sg.fields) if (f.label.toLowerCase().includes(term)) return true;
        }
        return false;
      });
  }, [q, effective]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar módulo, subgrupo, campo…" className="pl-8" />
      </div>

      <div className="grid gap-2">
        {list.length === 0 && (
          <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum módulo encontrado.</CardContent></Card>
        )}
        {list.map((m) => {
          const subs = m.subgroups?.length ?? 0;
          const fields = (m.fields?.length ?? 0) + (m.subgroups ?? []).reduce((acc, s) => acc + s.fields.length, 0);
          const used = moduleUsage[m.id] ?? [];
          return (
            <Card key={m.id} className="hover:border-primary/40 transition-colors">
              <CardContent className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{m.title}</span>
                    {(m.purposes ?? []).map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{MODULE_PURPOSE_LABELS[p]}</Badge>
                    ))}
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1"><ListTree className="h-3 w-3" />{subs} subgrupo(s)</span>
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{fields} campo(s)</span>
                    {used.length > 0 && (
                      <span>Usado em: {used.map((u) => SURVEY_TYPES.find((t) => t.id === u)?.label.split(" ")[0]).join(", ")}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onOpenStructure(m.id)}
                  className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Layers className="h-3.5 w-3.5" /> Ver estrutura <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
