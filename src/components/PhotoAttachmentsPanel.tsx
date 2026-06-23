import { useMemo, useRef, type ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, ImagePlus, Trash2, AlertTriangle } from "lucide-react";
import { addAttachment, removeAttachment, setPhotoNote } from "@/lib/store";
import { attachmentFromFile, attachmentSrc } from "@/lib/attachments";
import { PHOTO_CHECKLISTS, defaultTemplateKeyFor } from "@/lib/photoChecklists";
import type { Attachment, ModuleState, Survey } from "@/lib/types";

const PHOTOS_MOD = "fotos";

function id() {
  return Math.random().toString(36).slice(2, 11);
}

interface Props {
  survey: Survey;
  readOnly?: boolean;
}

export function PhotoAttachmentsPanel({ survey, readOnly }: Props) {
  const state = (survey.modules[PHOTOS_MOD] ?? { attachments: [] }) as ModuleState;
  const activeKey = useMemo(
    () => defaultTemplateKeyFor(survey.type, survey.customTypeId),
    [survey.type, survey.customTypeId],
  );
  const activeTitle = PHOTO_CHECKLISTS[activeKey]?.title ?? "Relatorio fotografico";
  const answers = (state.photoChecklist ?? []).filter(
    (answer) => answer.registrado === true && answer.templateKey === activeKey,
  );

  const attachments = state.attachments ?? [];
  const attsByItem = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const att of attachments) {
      if (!att.photoItemId) continue;
      const arr = map.get(att.photoItemId) ?? [];
      arr.push(att);
      map.set(att.photoItemId, arr);
    }
    return map;
  }, [attachments]);

  if (answers.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <h3 className="mb-1 font-semibold">{activeTitle}</h3>
          <p className="text-sm text-muted-foreground">
            Nenhum item fotografico foi marcado para anexo neste levantamento. Volte ao modulo
            fotografico do tipo para indicar quais registros foram realmente realizados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const aguardando = answers.filter((answer) => (attsByItem.get(answer.itemId) ?? []).length === 0).length;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{activeTitle}</h3>
          {aguardando > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
              style={{ color: "var(--status-pending)", borderColor: "var(--status-pending)" }}
            >
              <AlertTriangle className="h-3 w-3" /> {aguardando} item(ns) aguardando anexo
            </span>
          )}
        </div>

        <div className="grid gap-2">
          {answers.map((answer) => (
            <PhotoItemRow
              key={answer.itemId}
              surveyId={survey.id}
              composedId={answer.itemId}
              label={answer.label}
              observacao={answer.observacao ?? ""}
              attachments={attsByItem.get(answer.itemId) ?? []}
              readOnly={readOnly}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PhotoItemRow({
  surveyId,
  composedId,
  label,
  observacao,
  attachments,
  readOnly,
}: {
  surveyId: string;
  composedId: string;
  label: string;
  observacao: string;
  attachments: Attachment[];
  readOnly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(e: ChangeEvent<HTMLInputElement>, origin: "camera" | "biblioteca") {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    for (const file of files) {
      const attId = id();
      addAttachment(surveyId, PHOTOS_MOD, await attachmentFromFile(file, {
        id: attId,
        surveyId,
        createdAt: new Date().toISOString(),
        category: "Fotos",
        moduleTag: "fotos",
        photoItemId: composedId,
        origin,
      }));
    }
    e.target.value = "";
  }

  const empty = attachments.length === 0;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="break-words text-sm font-medium">{label}</span>
          {empty && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
              style={{
                background: "color-mix(in oklab, var(--status-pending) 15%, transparent)",
                color: "var(--status-pending)",
              }}
            >
              Aguardando anexo
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-1 h-3 w-3" /> Camera
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-1 h-3 w-3" /> Anexar imagens
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              hidden
              onChange={(e) => handleFiles(e, "camera")}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => handleFiles(e, "biblioteca")}
            />
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {attachments.map((att) => (
            <div key={att.id} className="group relative">
              <img
                src={attachmentSrc(att)}
                alt={att.name}
                className="h-20 w-full rounded border border-border object-cover"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeAttachment(surveyId, PHOTOS_MOD, att.id)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded bg-black/70 text-white shadow-sm transition hover:bg-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Remover imagem ${att.name}`}
                  title="Remover imagem"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Input
        defaultValue={observacao}
        placeholder="Observacao opcional"
        className="h-8 text-sm"
        disabled={readOnly}
        onBlur={(e) => {
          const value = e.target.value;
          if (value !== observacao) setPhotoNote(surveyId, composedId, value);
        }}
      />
    </div>
  );
}
