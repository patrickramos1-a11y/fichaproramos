import { useMemo, useState } from "react";
import {
  PHOTO_CHECKLISTS,
  ALL_TEMPLATE_KEYS,
  defaultTemplateKeysFor,
  composeItemId,
  type PhotoChecklistKey,
} from "@/lib/photoChecklists";
import {
  setPhotoChecklistKeys,
  setPhotoAnswer,
  setPhotoNote,
  setPhotoLiberadoDivulgacao,
  bulkSetPhotoAnswers,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Check, Plus, X, MessageSquare, ChevronDown, ChevronRight,
  Camera as CameraIcon, RotateCcw,
} from "lucide-react";
import type { Attachment, ModuleState, Survey } from "@/lib/types";

type FilterMode = "pendentes" | "sim" | "nao" | "todos";

interface Props {
  survey: Survey;
  moduleState: ModuleState;
}

export function PhotoChecklist({ survey, moduleState }: Props) {
  const activeKeys: PhotoChecklistKey[] = useMemo(() => {
    const stored = (moduleState.photoChecklistKeys ?? []) as PhotoChecklistKey[];
    return stored.length ? stored : defaultTemplateKeysFor(survey.type);
  }, [moduleState.photoChecklistKeys, survey.type]);

  const answers = moduleState.photoChecklist ?? [];
  const answerMap = useMemo(
    () => new Map(answers.map((a) => [a.itemId, a] as const)),
    [answers],
  );

  // contagem de fotos por itemId
  const photoCountByItem = useMemo(() => {
    const map = new Map<string, number>();
    for (const att of (moduleState.attachments ?? []) as Attachment[]) {
      if (!att.photoItemId) continue;
      map.set(att.photoItemId, (map.get(att.photoItemId) ?? 0) + 1);
    }
    return map;
  }, [moduleState.attachments]);

  const remainingKeys = ALL_TEMPLATE_KEYS.filter((k) => !activeKeys.includes(k));

  function addTemplate(key: PhotoChecklistKey) {
    setPhotoChecklistKeys(survey.id, [...activeKeys, key]);
  }
  function removeTemplate(key: PhotoChecklistKey) {
    setPhotoChecklistKeys(survey.id, activeKeys.filter((k) => k !== key));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Modelos ativos:</span>
        {activeKeys.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs"
          >
            {PHOTO_CHECKLISTS[k].title}
            {activeKeys.length > 1 && (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeTemplate(k)}
                aria-label="Remover modelo"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {remainingKeys.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Adicionar checklist
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1 z-50">
              <div className="grid">
                {remainingKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="text-left text-sm px-2 py-1.5 rounded hover:bg-accent"
                    onClick={() => addTemplate(k)}
                  >
                    {PHOTO_CHECKLISTS[k].title}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {activeKeys.map((key) => (
        <ChecklistTemplateCard
          key={key}
          surveyId={survey.id}
          templateKey={key}
          answerMap={answerMap}
          photoCountByItem={photoCountByItem}
          isPost={key === "post"}
          liberado={moduleState.photoLiberadoDivulgacao}
        />
      ))}
    </div>
  );
}

function ChecklistTemplateCard({
  surveyId,
  templateKey,
  answerMap,
  photoCountByItem,
  isPost,
  liberado,
}: {
  surveyId: string;
  templateKey: PhotoChecklistKey;
  answerMap: Map<string, import("@/lib/types").PhotoChecklistAnswer>;
  photoCountByItem: Map<string, number>;
  isPost: boolean;
  liberado: boolean | undefined;
}) {
  const tpl = PHOTO_CHECKLISTS[templateKey];
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("pendentes");

  const total = tpl.items.length;
  let answered = 0;
  let sim = 0;
  let nao = 0;
  for (const it of tpl.items) {
    const ans = answerMap.get(composeItemId(templateKey, it.id));
    if (ans?.registrado === true) { answered++; sim++; }
    else if (ans?.registrado === false) { answered++; nao++; }
  }
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);

  const pendentes = total - answered;
  // Após responder tudo, mostra naturalmente todos (não fica "vazio").
  const effectiveFilter: FilterMode =
    filter === "pendentes" && pendentes === 0 ? "todos" : filter;

  const visibleItems = tpl.items.filter((it) => {
    const ans = answerMap.get(composeItemId(templateKey, it.id));
    if (effectiveFilter === "todos") return true;
    if (effectiveFilter === "pendentes") return ans?.registrado === undefined;
    if (effectiveFilter === "sim") return ans?.registrado === true;
    if (effectiveFilter === "nao") return ans?.registrado === false;
    return true;
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 text-sm font-semibold min-w-0"
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="truncate">{tpl.title}</span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground tabular-nums">
              {answered}/{total}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => bulkSetPhotoAnswers(surveyId, templateKey, tpl.items, true)}
            >
              Todos Sim
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => bulkSetPhotoAnswers(surveyId, templateKey, tpl.items, false)}
            >
              Todos Não
            </Button>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--status-done), color-mix(in oklab, var(--status-done) 60%, var(--status-pending)))",
            }}
          />
        </div>
        {!collapsed && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            <FilterChip
              active={effectiveFilter === "pendentes"}
              onClick={() => setFilter("pendentes")}
              label="Pendentes"
              count={pendentes}
            />
            <FilterChip
              active={effectiveFilter === "sim"}
              onClick={() => setFilter("sim")}
              label="Sim"
              count={sim}
              color="var(--status-done)"
            />
            <FilterChip
              active={effectiveFilter === "nao"}
              onClick={() => setFilter("nao")}
              label="Não"
              count={nao}
              color="var(--destructive)"
            />
            <FilterChip
              active={effectiveFilter === "todos"}
              onClick={() => setFilter("todos")}
              label="Todos"
              count={total}
            />
          </div>
        )}

        {!collapsed && (
          <ul className="grid gap-1.5">
            {visibleItems.length === 0 && (
              <li className="text-[11px] text-muted-foreground italic px-1 py-2">
                Nenhum item neste filtro.
              </li>
            )}
            {visibleItems.map((it) => {
              const composed = composeItemId(templateKey, it.id);
              const ans = answerMap.get(composed);
              const photoCount = photoCountByItem.get(composed) ?? 0;
              return (
                <ChecklistItemRow
                  key={it.id}
                  surveyId={surveyId}
                  templateKey={templateKey}
                  itemId={it.id}
                  composedId={composed}
                  label={it.label}
                  registrado={ans?.registrado}
                  observacao={ans?.observacao ?? ""}
                  photoCount={photoCount}
                />
              );
            })}
          </ul>
        )}

        {isPost && !collapsed && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2.5">
            <span className="text-sm font-medium">Liberado para divulgação?</span>
            <SimNaoToggle
              value={liberado}
              onChange={(v) => setPhotoLiberadoDivulgacao(surveyId, v)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({
  active, onClick, label, count, color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors";
  if (active) {
    const c = color ?? "var(--primary)";
    return (
      <button
        type="button"
        onClick={onClick}
        className={base}
        style={{ background: c, color: "white", borderColor: c }}
      >
        {label}
        <span className="rounded-full bg-white/25 px-1 tabular-nums">{count}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} bg-transparent text-muted-foreground hover:bg-accent`}
      style={{ borderColor: "var(--border)" }}
    >
      {label}
      <span
        className="rounded-full px-1 tabular-nums"
        style={color ? { color } : undefined}
      >
        {count}
      </span>
    </button>
  );
}

function ChecklistItemRow({
  surveyId,
  templateKey,
  itemId,
  composedId,
  label,
  registrado,
  observacao,
  photoCount,
}: {
  surveyId: string;
  templateKey: PhotoChecklistKey;
  itemId: string;
  composedId: string;
  label: string;
  registrado: boolean | undefined;
  observacao: string;
  photoCount: number;
}) {
  const answered = registrado !== undefined;

  if (answered) {
    // Modo compacto (chip)
    const isYes = registrado === true;
    const bg = isYes ? "var(--status-done)" : "var(--destructive)";
    return (
      <li
        className="flex items-center gap-2 rounded-full pl-2.5 pr-1 py-0.5 text-xs"
        style={{
          background: `color-mix(in oklab, ${bg} 12%, transparent)`,
          border: `1px solid color-mix(in oklab, ${bg} 50%, transparent)`,
          color: bg,
        }}
      >
        <span
          className="inline-flex items-center justify-center h-4 w-4 rounded-full"
          style={{ background: bg, color: "white" }}
        >
          {isYes ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        </span>
        <span className="flex-1 min-w-0 truncate font-medium" title={label}>
          {label}
        </span>
        {isYes && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ background: bg, color: "white" }}
            title={`${photoCount} foto(s) anexada(s)`}
          >
            <CameraIcon className="h-2.5 w-2.5" />
            {photoCount}
          </span>
        )}
        {observacao && (
          <NotePopover
            value={observacao}
            onChange={(v) => setPhotoNote(surveyId, composedId, v)}
            color={bg}
          />
        )}
        <button
          type="button"
          onClick={() => setPhotoAnswer(surveyId, templateKey, itemId, label, !registrado)}
          className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-black/10"
          title="Inverter resposta"
          style={{ color: bg }}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </li>
    );
  }

  // Modo pendente: Sim/Não grandes
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-1.5">
      <span className="text-sm flex-1 min-w-0 break-words">{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        <SimNaoToggle
          value={registrado}
          onChange={(v) => setPhotoAnswer(surveyId, templateKey, itemId, label, v)}
        />
        <NotePopover
          value={observacao}
          onChange={(v) => {
            // garante que o item exista antes de salvar a nota
            if (registrado === undefined) {
              setPhotoAnswer(surveyId, templateKey, itemId, label, true);
            }
            setPhotoNote(surveyId, composedId, v);
          }}
        />
      </div>
    </li>
  );
}

function SimNaoToggle({
  value,
  onChange,
}: {
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const base = "h-7 px-3 text-xs font-medium rounded-md border transition-colors";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={base}
        style={
          value === true
            ? { background: "var(--status-done)", color: "white", borderColor: "var(--status-done)" }
            : { background: "transparent", color: "inherit", borderColor: "var(--border)" }
        }
        aria-pressed={value === true}
      >
        <Check className="h-3 w-3 inline -mt-0.5 mr-0.5" />Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={base}
        style={
          value === false
            ? { background: "var(--destructive)", color: "white", borderColor: "var(--destructive)" }
            : { background: "transparent", color: "inherit", borderColor: "var(--border)" }
        }
        aria-pressed={value === false}
      >
        <X className="h-3 w-3 inline -mt-0.5 mr-0.5" />Não
      </button>
    </div>
  );
}

function NotePopover({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: string) => void;
  color?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setDraft(value);
        else if (draft !== value) onChange(draft);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center h-5 w-5 rounded-full hover:bg-black/10"
          title={value ? "Observação registrada" : "Adicionar observação"}
          style={color ? { color } : undefined}
        >
          <MessageSquare className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 z-50">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Observação opcional"
          className="h-8 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}
