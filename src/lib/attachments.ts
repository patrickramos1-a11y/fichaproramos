import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "./types";

export function attachmentSrc(attachment: Attachment) {
  if (attachment.dataUrl) return attachment.dataUrl;
  if (attachment.r2Key) return `/api/attachments/file?key=${encodeURIComponent(attachment.r2Key)}`;
  return "";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function attachmentFromFile(file: File, params: {
  id: string;
  surveyId: string;
  createdAt: string;
  category?: string;
  moduleTag?: string;
  photoItemId?: string;
  origin?: Attachment["origin"];
}): Promise<Attachment> {
  if (import.meta.env.VITE_DATA_BACKEND === "d1") {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const body = new FormData();
    body.set("file", file);
    body.set("surveyId", params.surveyId);
    body.set("attachmentId", params.id);
    const response = await fetch("/api/attachments/upload", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body,
    });
    if (!response.ok) throw new Error(await response.text());
    const uploaded = await response.json() as { r2Key: string; size: number };
    return {
      id: params.id,
      name: file.name,
      type: file.type || "application/octet-stream",
      r2Key: uploaded.r2Key,
      size: uploaded.size,
      createdAt: params.createdAt,
      category: params.category,
      moduleTag: params.moduleTag,
      photoItemId: params.photoItemId,
      origin: params.origin,
    };
  }

  return {
    id: params.id,
    name: file.name,
    type: file.type || "application/octet-stream",
    dataUrl: await readFileAsDataUrl(file),
    size: file.size,
    createdAt: params.createdAt,
    category: params.category,
    moduleTag: params.moduleTag,
    photoItemId: params.photoItemId,
    origin: params.origin,
  };
}
