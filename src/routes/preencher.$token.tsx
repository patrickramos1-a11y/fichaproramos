import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldRenderer } from "@/components/FieldRenderer";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import {
  computeModuleStatus,
  computeSubgroupStatus,
  shouldShowField,
  subgroupProgress,
} from "@/lib/modules";
import { getEffectiveModulesForCustomType, getEffectiveModulesForType } from "@/lib/modules";
import type {
  CustomSurveyType,
  FieldStatus,
  FormStructureOverrides,
  ModuleDef,
  ModuleState,
  Survey,
} from "@/lib/types";
import { Check, Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/preencher/$token")({
  component: PublicSurveyFill,
});

type PublicPayload = {
  survey: Survey;
  customType?: CustomSurveyType | null;
  formOverrides?: FormStructureOverrides | null;
};

const USE_D1_BACKEND = import.meta.env.VITE_DATA_BACKEND === "d1";

function PublicSurveyFill() {
  const { token } = Route.useParams();
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorName, setEditorName] = useState("");
  const [activeModuleId, setActiveModuleId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const result = USE_D1_BACKEND
        ? await fetch(`/api/public-survey/${encodeURIComponent(token)}`).then(async (response) => ({
            data: response.ok ? await response.json() : null,
            error: response.ok ? null : new Error(await response.text()),
          }))
        : await (supabase as any).rpc("get_public_survey", { p_token: token });
      const { data, error: rpcError } = result;
      if (cancelled) return;
      if (rpcError) {
        setError(
          rpcError.message?.includes("function")
            ? "Link externo ainda nao configurado no Supabase. Aplique a migration de compartilhamento publico."
            : rpcError.message || "Nao foi possivel carregar o levantamento.",
        );
        setLoading(false);
        return;
      }
      if (!data?.survey) {
        setError("Link invalido, revogado ou expirado.");
        setLoading(false);
        return;
      }
      const nextPayload = data as PublicPayload;
      setPayload(nextPayload);
      setActiveModuleId(firstModuleId(nextPayload));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const modules = useMemo(() => {
    if (!payload?.survey) return [];
    return resolveModules(payload);
  }, [payload]);

  const enabledModules = useMemo(() => {
    if (!payload?.survey) return [];
    const enabled = new Set(payload.survey.enabledModules ?? modules.map((module) => module.id));
    return modules.filter((module) => enabled.has(module.id));
  }, [modules, payload?.survey]);

  const survey = payload?.survey;
  const activeModule = enabledModules.find((module) => module.id === activeModuleId) ?? enabledModules[0];

  function patchSurvey(patch: Partial<Survey>) {
    if (!payload) return;
    setPayload({ ...payload, survey: { ...payload.survey, ...patch } });
    setDirty(true);
  }

  function patchModule(moduleId: string, patch: Partial<ModuleState>) {
    if (!survey) return;
    const current = survey.modules[moduleId] ?? createPublicModuleState();
    patchSurvey({
      modules: {
        ...survey.modules,
        [moduleId]: { ...current, ...patch },
      },
    });
  }

  function setField(moduleId: string, fieldId: string, value: unknown) {
    if (!survey) return;
    const current = survey.modules[moduleId] ?? createPublicModuleState();
    patchModule(moduleId, {
      values: { ...(current.values ?? {}), [fieldId]: value },
      fieldStatus: { ...(current.fieldStatus ?? {}), [fieldId]: "concluido" },
    });
  }

  function setStatus(moduleId: string, fieldId: string, status: FieldStatus) {
    const current = survey?.modules[moduleId] ?? createPublicModuleState();
    patchModule(moduleId, {
      fieldStatus: { ...(current.fieldStatus ?? {}), [fieldId]: status },
    });
  }

  function setNA(moduleId: string, fieldId: string, na: boolean) {
    const current = survey?.modules[moduleId] ?? createPublicModuleState();
    patchModule(moduleId, {
      nonApplicable: { ...(current.nonApplicable ?? {}), [fieldId]: na },
      fieldStatus: { ...(current.fieldStatus ?? {}), [fieldId]: na ? "nao_se_aplica" : "nao_iniciado" },
    });
  }

  async function save() {
    if (!payload) return;
    setSaving(true);
    const patch = {
      modules: payload.survey.modules,
      pendencias: payload.survey.pendencias ?? [],
      signatures: payload.survey.signatures ?? {},
    };
    const result = USE_D1_BACKEND
      ? await fetch(`/api/public-survey/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ patch, editorName: editorName.trim() || null }),
        }).then(async (response) => ({
          data: response.ok ? await response.json() : null,
          error: response.ok ? null : new Error(await response.text()),
        }))
      : await (supabase as any).rpc("update_public_survey", {
          p_token: token,
          p_patch: patch,
          p_editor_name: editorName.trim() || null,
        });
    const { data, error: rpcError } = result;
    setSaving(false);
    if (rpcError) {
      toast.error(rpcError.message || "Nao foi possivel salvar.");
      return;
    }
    if (data?.survey) setPayload(data as PublicPayload);
    setDirty(false);
    toast.success("Levantamento salvo.");
  }

  if (loading) {
    return (
      <PublicShell>
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando levantamento...</span>
        </div>
      </PublicShell>
    );
  }

  if (error || !survey) {
    return (
      <PublicShell>
        <Card className="mx-auto mt-10 max-w-xl">
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <div className="font-medium text-foreground">Nao foi possivel abrir o link.</div>
            <p>{error || "Levantamento indisponivel."}</p>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-5">
        <Card className="sticky top-2 z-20 border-primary/20 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Preenchimento externo restrito</div>
              <h1 className="break-words text-lg font-semibold">{survey.title}</h1>
              <p className="text-xs text-muted-foreground">Este link libera somente este levantamento.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-[180px]">
                <label className="text-xs text-muted-foreground">Seu nome (opcional)</label>
                <Input value={editorName} onChange={(event) => setEditorName(event.target.value)} placeholder="Quem preencheu" />
              </div>
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                {dirty ? "Salvar" : "Salvo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {enabledModules.map((module) => {
            const moduleState = survey.modules[module.id] ?? createPublicModuleState();
            const status = computeModuleStatus(module, moduleState);
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => setActiveModuleId(module.id)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  activeModule?.id === module.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                }`}
              >
                {module.title} <span className="ml-1 opacity-75">· {status === "concluido" ? "ok" : status === "nao_se_aplica" ? "N/A" : "..."}</span>
              </button>
            );
          })}
        </div>

        {activeModule ? (
          <PublicModuleCard
            module={activeModule}
            moduleState={survey.modules[activeModule.id] ?? createPublicModuleState()}
            onFieldChange={(fieldId, value) => setField(activeModule.id, fieldId, value)}
            onFieldStatus={(fieldId, status) => setStatus(activeModule.id, fieldId, status)}
            onFieldNA={(fieldId, na) => setNA(activeModule.id, fieldId, na)}
          />
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum modulo habilitado para preenchimento.</CardContent></Card>
        )}
      </div>
    </PublicShell>
  );
}

function PublicModuleCard({
  module,
  moduleState,
  onFieldChange,
  onFieldStatus,
  onFieldNA,
}: {
  module: ModuleDef;
  moduleState: ModuleState;
  onFieldChange: (fieldId: string, value: unknown) => void;
  onFieldStatus: (fieldId: string, status: FieldStatus) => void;
  onFieldNA: (fieldId: string, na: boolean) => void;
}) {
  const moduleStatus = computeModuleStatus(module, moduleState);
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="break-words text-xl">{module.title}</CardTitle>
            {module.description && <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>}
          </div>
          <StatusBadge status={moduleStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {module.fields?.length ? (
          <div className="grid gap-3">
            {module.fields.filter((field) => shouldShowField(field, moduleState.values ?? {})).map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={moduleState.values?.[field.id]}
                status={moduleState.fieldStatus?.[field.id] ?? "nao_iniciado"}
                note={moduleState.fieldNotes?.[field.id]}
                na={moduleState.nonApplicable?.[field.id]}
                moduleValues={moduleState.values}
                onChange={(value) => onFieldChange(field.id, value)}
                onStatus={(status) => onFieldStatus(field.id, status)}
                onNA={(na) => onFieldNA(field.id, na)}
              />
            ))}
          </div>
        ) : null}
        {(module.subgroups ?? []).map((subgroup) => {
          const progress = subgroupProgress(subgroup, moduleState);
          const status = computeSubgroupStatus(subgroup, moduleState);
          return (
            <div key={subgroup.id} className="rounded-xl border p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{subgroup.title}</div>
                  {subgroup.description && <div className="text-sm text-muted-foreground">{subgroup.description}</div>}
                </div>
                <div className="text-xs text-muted-foreground">{progress.filled}/{progress.total} · {status}</div>
              </div>
              <div className="grid gap-3">
                {(subgroup.fields ?? []).filter((field) => shouldShowField(field, moduleState.values ?? {})).map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={moduleState.values?.[field.id]}
                    status={moduleState.fieldStatus?.[field.id] ?? "nao_iniciado"}
                    note={moduleState.fieldNotes?.[field.id]}
                    na={moduleState.nonApplicable?.[field.id]}
                    moduleValues={moduleState.values}
                    onChange={(value) => onFieldChange(field.id, value)}
                    onStatus={(nextStatus) => onFieldStatus(field.id, nextStatus)}
                    onNA={(na) => onFieldNA(field.id, na)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {moduleStatus === "concluido" && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" /> Modulo com campos preenchidos/concluidos.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function resolveModules(payload: PublicPayload) {
  if (payload.customType) {
    return getEffectiveModulesForCustomType(payload.customType, payload.formOverrides ?? undefined);
  }
  return getEffectiveModulesForType(payload.survey.type, payload.formOverrides ?? undefined);
}

function firstModuleId(payload: PublicPayload) {
  const modules = resolveModules(payload);
  const enabled = new Set(payload.survey.enabledModules ?? modules.map((module) => module.id));
  return modules.find((module) => enabled.has(module.id))?.id ?? modules[0]?.id ?? "";
}

function createPublicModuleState(): ModuleState {
  return {
    status: "nao_iniciado",
    values: {},
    fieldStatus: {},
    attachments: [],
    fieldNotes: {},
    nonApplicable: {},
  };
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
