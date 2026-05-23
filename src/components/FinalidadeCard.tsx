import { Card, CardContent } from "@/components/ui/card";
import { ALL_SURVEY_PURPOSES, SURVEY_PURPOSE_LABELS, SURVEY_PURPOSE_DESCRIPTIONS, type SurveyPurpose } from "@/lib/types";
import { setSurveyPurposes } from "@/lib/store";
import { Check, Target } from "lucide-react";

interface Props {
  surveyId: string;
  purposes: SurveyPurpose[];
  readOnly?: boolean;
  compact?: boolean;
}

/**
 * Módulo obrigatório "Para que serve este levantamento" (Fase 2).
 * Renderizado no topo do editor de levantamento. Seleção múltipla.
 */
export function FinalidadeCard({ surveyId, purposes, readOnly, compact }: Props) {
  const selected = new Set(purposes ?? []);

  function toggle(p: SurveyPurpose) {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    setSurveyPurposes(surveyId, ALL_SURVEY_PURPOSES.filter((x) => next.has(x)));
  }

  const empty = selected.size === 0;

  return (
    <Card className={empty ? "border-warn/50 bg-warn-soft" : ""}>
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-2 mb-2">
          <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Para que serve este levantamento?</div>
            <div className="text-[11px] text-muted-foreground">
              Selecione uma ou mais finalidades. {empty && <span className="text-warn-foreground font-medium">Pelo menos uma é obrigatória para encerrar.</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SURVEY_PURPOSES.map((p) => {
            const isOn = selected.has(p);
            return (
              <button
                key={p}
                type="button"
                disabled={readOnly}
                title={SURVEY_PURPOSE_DESCRIPTIONS[p]}
                onClick={() => toggle(p)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  isOn
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                } ${readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {isOn && <Check className="h-3 w-3" />}
                {SURVEY_PURPOSE_LABELS[p]}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Chips compactos de finalidade para exibir em cards de listagem. */
export function PurposeChips({ purposes, max = 4 }: { purposes?: SurveyPurpose[]; max?: number }) {
  const list = purposes ?? [];
  if (!list.length) return null;
  const visible = list.slice(0, max);
  const overflow = list.length - visible.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((p) => (
        <span
          key={p}
          className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"
        >
          {SURVEY_PURPOSE_LABELS[p]}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground">+{overflow}</span>
      )}
    </div>
  );
}
