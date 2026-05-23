import { useMemo, useRef, type ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, ImagePlus, Trash2, AlertTriangle } from "lucide-react";
import { addAttachment, removeAttachment, setPhotoNote } from "@/lib/store";
import { PHOTO_CHECKLISTS, type PhotoChecklistKey } from "@/lib/photoChecklists";
import type { Attachment, ModuleState, Survey } from "@/lib/types";

const PHOTOS_MOD = "fotos";

function id() {
  return Math.random().toString(36).slice(2, 11);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface Props {
  survey: Survey;
  /** Quando true, oculta itens marcados como "Não" sem permitir reabrir (modo só leitura). */
  readOnly?: boolean;
}

export function PhotoAttachmentsPanel({ survey, readOnly }: Props) {
  const state = (survey.modules[PHOTOS_MOD] ?? { attachments: [] }) as ModuleState;
  const answers = (state.photoChecklist ?? []).filter((a) => a.registrado === true);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof answers>();
    for (const a of answers) {
      const arr = map.get(a.templateKey) ?? [];
      arr.push(a);
      map.set(a.templateKey, arr);
    }
    return map;
  }, [answers]);

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
          <h3 className="font-semibold mb-1">Anexar fotos do relatório fotográfico</h3>
          <p className="text-sm text-muted-foreground">
            Nenhum item marcado como “Sim” no checklist. Volte ao módulo Relatório
            Fotográfico para escolher quais fotos foram realizadas.
          </p>
        </CardContent>
      </Card>
    );
  }

  const aguardando = answers.filter((a) => (attsByItem.get(a.itemId) ?? []).length === 0).length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Anexar fotos do relatório fotográfico</h3>
          {aguardando > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs rounded-full border px-2 py-0.5"
              style={{ color: "var(--status-pending)", borderColor: "var(--status-pending)" }}
            >
              <AlertTriangle className="h-3 w-3" /> {aguardando} item(s) aguardando anexo
            </span>
          )}
        </div>

        {Array.from(grouped.entries()).map(([templateKey, items]) => {
          const tplTitle =
            PHOTO_CHECKLISTS[templateKey as PhotoChecklistKey]?.title ?? templateKey;
          return (
            <div key={templateKey} className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {tplTitle}
              </div>
              <div className="grid gap-2">
                {items.map((a) => (
                  <PhotoItemRow
                    key={a.itemId}
                    surveyId={survey.id}
                    composedId={a.itemId}
                    label={a.label}
                    observacao={a.observacao ?? ""}
                    attachments={attsByItem.get(a.itemId) ?? []}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
      const dataUrl = await readFileAsDataUrl(file);
      addAttachment(surveyId, PHOTOS_MOD, {
        id: id(),
        name: file.name,
        type: file.type || "image/*",
        dataUrl,
        createdAt: new Date().toISOString(),
        category: "Fotos",
        moduleTag: "fotos",
        photoItemId: composedId,
        origin,
      });
    }
    e.target.value = "";
  }

  const empty = attachments.length === 0;

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium break-words">{label}</span>
          {empty && (
            <span
              className="text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5"
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
              <Camera className="h-3 w-3 mr-1" /> Câmera
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-3 w-3 mr-1" /> Anexar imagens
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
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-2">
          {attachments.map((att) => (
            <div key={att.id} className="relative group">
              <img
                src={att.dataUrl}
                alt={att.name}
                className="w-full h-20 object-cover rounded border border-border"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeAttachment(surveyId, PHOTOS_MOD, att.id)}
                  className="absolute top-1 right-1 rounded bg-black/60 text-white p-0.5 opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remover imagem"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Input
        defaultValue={observacao}
        placeholder="Observação opcional"
        className="h-8 text-sm"
        disabled={readOnly}
        onBlur={(e) => {
          const v = e.target.value;
          if (v !== observacao) setPhotoNote(surveyId, composedId, v);
        }}
      />
    </div>
  );
}