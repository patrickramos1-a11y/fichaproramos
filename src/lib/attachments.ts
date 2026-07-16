import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "./types";

const BUCKET = "survey-photos";

/** Devolve uma URL utilizável em `<img src>` / `<a href>` para o anexo. */
export function attachmentSrc(attachment: Attachment): string {
  if (attachment.storagePath) {
    return `/api/public/photo/${attachment.storagePath}`;
  }
  if (attachment.dataUrl) return attachment.dataUrl;
  if (attachment.r2Key) return `/api/attachments/file?key=${encodeURIComponent(attachment.r2Key)}`;
  return "";
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Redimensiona/comprime imagens grandes antes do upload para reduzir tráfego e memória. */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && file.size < 800_000) return file;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as CanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = "convertToBlob" in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality })
      : await new Promise<Blob>((res, rej) => (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        ));
    bitmap.close?.();
    // Só usa a versão comprimida se realmente ficou menor.
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "arquivo";
}

interface AttachmentParams {
  id: string;
  surveyId: string;
  createdAt: string;
  category?: string;
  moduleTag?: string;
  photoItemId?: string;
  origin?: Attachment["origin"];
}

/**
 * Envia o arquivo para o Supabase Storage e devolve um `Attachment` leve
 * (sem base64 embutido). Em caso de falha (offline, sem sessão), guarda o
 * conteúdo como `dataUrl` marcado como `pendingUpload` para retomada.
 */
export async function attachmentFromFile(file: File, params: AttachmentParams): Promise<Attachment> {
  const compressed = await compressImage(file);
  const contentType = compressed.type || file.type || "application/octet-stream";
  const ext = contentType === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "bin").toLowerCase();
  const safeName = sanitizeName(file.name.replace(/\.[^.]+$/, "") + "." + ext);
  const storagePath = `surveys/${params.surveyId}/${params.id}-${safeName}`;

  const base: Attachment = {
    id: params.id,
    name: file.name,
    type: contentType,
    size: compressed.size,
    createdAt: params.createdAt,
    category: params.category,
    moduleTag: params.moduleTag,
    photoItemId: params.photoItemId,
    origin: params.origin,
  };

  try {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, compressed, {
      contentType,
      upsert: true,
      cacheControl: "31536000",
    });
    if (error) throw error;
    return { ...base, storagePath };
  } catch (err) {
    console.warn("[attachments] upload falhou, salvando local para retomada", err);
    return { ...base, dataUrl: await readFileAsDataUrl(compressed), pendingUpload: true };
  }
}

/** Retoma o upload de um anexo `pendingUpload` (chamada em background quando volta a rede). */
export async function retryAttachmentUpload(attachment: Attachment, surveyId: string): Promise<Attachment | null> {
  if (!attachment.pendingUpload || !attachment.dataUrl) return null;
  const res = await fetch(attachment.dataUrl);
  const blob = await res.blob();
  const ext = (attachment.type.split("/")[1] || "bin").toLowerCase();
  const safeName = sanitizeName(attachment.name.replace(/\.[^.]+$/, "") + "." + ext);
  const storagePath = `surveys/${surveyId}/${attachment.id}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: attachment.type,
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) return null;
  return { ...attachment, storagePath, dataUrl: undefined, pendingUpload: false };
}
