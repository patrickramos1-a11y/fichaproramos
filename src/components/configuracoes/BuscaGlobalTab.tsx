import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MODULES, MODULES_BY_TYPE, getModulesForType } from "@/lib/modules";
import { getSurveyClient, getSurveyProject } from "@/lib/surveyRelations";
import {
  SURVEY_TYPES,
  SURVEY_PURPOSE_LABELS,
  ALL_SURVEY_PURPOSES,
  type SurveyType,
  type SurveyPurpose,
} from "@/lib/types";
import { useDB, useCustomSurveyTypes } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, ChevronRight, Layers, Users, ClipboardList, Target, ListTree,
} from "lucide-react";

type StructureHit = {
  kind: "structure";
  type: SurveyType[];
  moduleId: string;
  moduleTitle: string;
  subgroupId?: string;
  subgroupTitle?: string;
  fieldId?: string;
  fieldLabel?: string;
  match: "module" | "subgroup" | "field" | "option";
  matched: string;
};

type ClientHit = {
  kind: "client";
  id: string;
  name: string;
  detail?: string;
  matched: string;
};

type SurveyHit = {
  kind: "survey";
  id: string;
  title: string;
  clientName?: string;
  status: string;
  matched: string;
};

type PurposeHit = {
  kind: "purpose";
  purpose: SurveyPurpose;
  count: number;
  matched: string;
};

type TypeHit = {
  kind: "type";
  id: string;
  label: string;
  inactive?: boolean;
  matched: string;
};

type Hit = StructureHit | ClientHit | SurveyHit | PurposeHit | TypeHit;

export function BuscaGlobalTab({ onOpen }: { onOpen: (moduleId: string) => void }) {
  const [q, setQ] = useState("");
  const db = useDB();
  const customTypes = useCustomSurveyTypes().filter((c) => !c.archivedAt);

  const hits: Hit[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const out: Hit[] = [];

    // 1) Tipos personalizados
    for (const ct of customTypes) {
      const hay = `${ct.label} ${ct.description ?? ""}`.toLowerCase();
      if (hay.includes(term)) {
        out.push({ kind: "type", id: ct.id, label: ct.label, inactive: ct.inactive, matched: ct.label });
      }
    }

    // 2) Clientes
    for (const c of db.clients) {
      const hay = `${c.name} ${c.cnpjCpf ?? ""} ${c.email ?? ""}`.toLowerCase();
      if (hay.includes(term)) {
        out.push({
          kind: "client", id: c.id, name: c.name,
          detail: c.cnpjCpf || c.email,
          matched: c.name,
        });
      }
    }

    // 3) Levantamentos
    for (const s of db.surveys) {
      const hay = `${s.title ?? ""} ${s.responsavel ?? ""} ${s.realizadoPor ?? ""}`.toLowerCase();
      if (hay.includes(term)) {
        const proj = getSurveyProject(s, db.projects);
        const client = getSurveyClient(s, db.clients, db.projects);
        out.push({
          kind: "survey", id: s.id, title: s.title || "(sem título)",
          clientName: client?.name, status: s.closedAt ? "Concluído" : "Em andamento",
          matched: s.title || "(sem título)",
        });
      }
    }

    // 4) Finalidades (purposes)
    for (const p of ALL_SURVEY_PURPOSES) {
      const label = SURVEY_PURPOSE_LABELS[p];
      if (label.toLowerCase().includes(term) || p.includes(term)) {
        const count = db.surveys.filter((s) => (s.purposes ?? []).includes(p)).length;
        out.push({ kind: "purpose", purpose: p, count, matched: label });
      }
    }

    // 5) Estrutura (módulos / subgrupos / campos / opções)
    const usage: Record<string, SurveyType[]> = {};
    for (const m of MODULES) usage[m.id] = [];
    for (const [type, ids] of Object.entries(MODULES_BY_TYPE) as [SurveyType, string[]][]) {
      for (const id of ids) usage[id]?.push(type);
    }

    const seenModules = new Map<string, ReturnType<typeof getModulesForType>[number]>();
    for (const t of SURVEY_TYPES) for (const m of getModulesForType(t.id)) if (!seenModules.has(m.id)) seenModules.set(m.id, m);

    for (const m of seenModules.values()) {
      const types = usage[m.id] ?? [];
      if (m.title.toLowerCase().includes(term) || (m.description ?? "").toLowerCase().includes(term)) {
        out.push({ kind: "structure", type: types, moduleId: m.id, moduleTitle: m.title, match: "module", matched: m.title });
      }
      for (const sg of m.subgroups ?? []) {
        if (sg.title.toLowerCase().includes(term)) {
          out.push({ kind: "structure", type: types, moduleId: m.id, moduleTitle: m.title, subgroupId: sg.id, subgroupTitle: sg.title, match: "subgroup", matched: sg.title });
        }
        for (const f of sg.fields) {
          if (f.label.toLowerCase().includes(term) || f.id.toLowerCase().includes(term)) {
            out.push({ kind: "structure", type: types, moduleId: m.id, moduleTitle: m.title, subgroupId: sg.id, subgroupTitle: sg.title, fieldId: f.id, fieldLabel: f.label, match: "field", matched: f.label });
          }
          for (const opt of f.options ?? []) {
            if (opt.toLowerCase().includes(term)) {
              out.push({ kind: "structure", type: types, moduleId: m.id, moduleTitle: m.title, subgroupId: sg.id, subgroupTitle: sg.title, fieldId: f.id, fieldLabel: f.label, match: "option", matched: opt });
            }
          }
        }
      }
    }
    return out.slice(0, 200);
  }, [q, db.clients, db.surveys, db.projects, customTypes]);

  // Agrupa por categoria
  const groups = useMemo(() => {
    return {
      types: hits.filter((h): h is TypeHit => h.kind === "type"),
      clients: hits.filter((h): h is ClientHit => h.kind === "client"),
      surveys: hits.filter((h): h is SurveyHit => h.kind === "survey"),
      purposes: hits.filter((h): h is PurposeHit => h.kind === "purpose"),
      structure: hits.filter((h): h is StructureHit => h.kind === "structure"),
    };
  }, [hits]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-2xl">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tipo, módulo, subgrupo, campo ou opção (mín. 2 caracteres)…"
          className="pl-10 h-11"
        />
      </div>

      {q.trim().length < 2 && (
        <p className="text-xs text-muted-foreground">
          Busca por tipos, clientes, levantamentos, finalidades, módulos, subgrupos, campos e opções.
          Exemplos: "profundidade", "poço", "outorga", "PCA", nome de cliente.
        </p>
      )}

      {q.trim().length >= 2 && hits.length === 0 && (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</CardContent></Card>
      )}

      {q.trim().length >= 2 && hits.length > 0 && (
        <div className="space-y-5">
          {groups.types.length > 0 && (
            <Section title="Tipos de levantamento" icon={ListTree} count={groups.types.length}>
              {groups.types.map((h) => (
                <Link
                  key={h.id}
                  to="/configuracoes/tipos/$typeId"
                  params={{ typeId: h.id }}
                  className="block rounded-md border bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">tipo</Badge>
                    <span className="text-sm font-medium">{h.label}</span>
                    {h.inactive && <Badge variant="secondary" className="text-[9px]">Inativo</Badge>}
                    <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      Abrir construtor <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {groups.clients.length > 0 && (
            <Section title="Clientes" icon={Users} count={groups.clients.length}>
              {groups.clients.map((h) => (
                <Link
                  key={h.id}
                  to="/clientes/$id"
                  params={{ id: h.id }}
                  className="block rounded-md border bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">cliente</Badge>
                    <span className="text-sm font-medium">{h.name}</span>
                    {h.detail && (
                      <span className="text-[11px] text-muted-foreground">{h.detail}</span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      Abrir cliente <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {groups.surveys.length > 0 && (
            <Section title="Levantamentos" icon={ClipboardList} count={groups.surveys.length}>
              {groups.surveys.map((h) => (
                <Link
                  key={h.id}
                  to="/levantamentos/$id"
                  params={{ id: h.id }}
                  search={{ mode: "edit" }}
                  className="block rounded-md border bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">levantamento</Badge>
                    <span className="text-sm font-medium">{h.title}</span>
                    <Badge variant="secondary" className="text-[9px]">{h.status}</Badge>
                    {h.clientName && (
                      <span className="text-[11px] text-muted-foreground">{h.clientName}</span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      Abrir <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {groups.purposes.length > 0 && (
            <Section title="Finalidades" icon={Target} count={groups.purposes.length}>
              {groups.purposes.map((h) => (
                <div
                  key={h.purpose}
                  className="rounded-md border bg-card px-3 py-2 flex items-center gap-2 flex-wrap"
                >
                  <Badge variant="outline" className="text-[10px]">finalidade</Badge>
                  <span className="text-sm font-medium">{SURVEY_PURPOSE_LABELS[h.purpose]}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {h.count} levantamento(s)
                  </span>
                </div>
              ))}
            </Section>
          )}

          {groups.structure.length > 0 && (
            <Section title="Estrutura dos formulários" icon={Layers} count={groups.structure.length}>
              {groups.structure.map((h, i) => (
                <button
                  key={i}
                  onClick={() => onOpen(h.moduleId)}
                  className="w-full text-left rounded-md border bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors px-3 py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] capitalize">{h.match === "option" ? "opção" : h.match === "field" ? "campo" : h.match === "subgroup" ? "subgrupo" : "módulo"}</Badge>
                    <span className="text-sm font-medium">{h.matched}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Abrir estrutura <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {h.type.map((t) => SURVEY_TYPES.find((s) => s.id === t)?.label.split(" ")[0]).filter(Boolean).join(" · ") || "Sem tipo"}
                    {" › "}{h.moduleTitle}
                    {h.subgroupTitle && <> {" › "}{h.subgroupTitle}</>}
                    {h.fieldLabel && h.match !== "field" && <> {" › "}{h.fieldLabel}</>}
                  </div>
                </button>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, count, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon className="h-3.5 w-3.5" />
        <span>{title}</span>
        <Badge variant="outline" className="text-[10px]">{count}</Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
