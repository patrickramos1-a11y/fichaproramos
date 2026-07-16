import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface Att {
  id: string;
  name?: string;
  type?: string;
  dataUrl?: string;
  storagePath?: string;
  size?: number;
  [k: string]: unknown;
}

interface SurveyRow {
  id: string;
  data: { modules?: Record<string, { attachments?: Att[] }>; [k: string]: unknown };
}

function sanitizeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "arquivo";
}

function dataUrlToBuffer(dataUrl: string): { buf: Buffer; type: string } {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("dataUrl inválido");
  const type = m[1] || "application/octet-stream";
  const isB64 = !!m[2];
  const payload = m[3];
  const buf = isB64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
  return { buf, type };
}

/**
 * Percorre até `limit` levantamentos que ainda tenham anexos em base64,
 * envia cada `dataUrl` para o bucket `survey-photos` e regrava o `data`
 * do levantamento sem o base64.
 */
export const migrateAttachmentsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => ({ limit: Math.min(Math.max(input?.limit ?? 3, 1), 10) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pega levantamentos ordenados pelos maiores (mais base64) primeiro.
    const { data: rows, error } = await context.supabase
      .from("surveys")
      .select("id, data")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const candidates: SurveyRow[] = [];
    for (const row of (rows ?? []) as SurveyRow[]) {
      const modules = row.data?.modules ?? {};
      const hasBase64 = Object.values(modules).some((m) =>
        (m?.attachments ?? []).some((a) => typeof a.dataUrl === "string" && a.dataUrl.startsWith("data:")),
      );
      if (hasBase64) candidates.push(row);
      if (candidates.length >= data.limit) break;
    }

    let migratedAttachments = 0;
    const results: { surveyId: string; migrated: number; failed: number }[] = [];

    for (const row of candidates) {
      let localMigrated = 0;
      let localFailed = 0;
      const modules = row.data.modules ?? {};
      for (const [modId, mod] of Object.entries(modules)) {
        const atts = mod?.attachments ?? [];
        for (let i = 0; i < atts.length; i++) {
          const att = atts[i];
          if (!att.dataUrl || !att.dataUrl.startsWith("data:")) continue;
          try {
            const { buf, type } = dataUrlToBuffer(att.dataUrl);
            const ext = (type.split("/")[1] || "bin").toLowerCase();
            const name = sanitizeName((att.name || `foto-${att.id}`).replace(/\.[^.]+$/, "") + "." + ext);
            const storagePath = `surveys/${row.id}/${att.id}-${name}`;
            const { error: upErr } = await supabaseAdmin.storage
              .from("survey-photos")
              .upload(storagePath, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
            if (upErr) throw upErr;
            atts[i] = { ...att, storagePath, dataUrl: undefined, size: buf.byteLength, type };
            localMigrated++;
            migratedAttachments++;
          } catch (e) {
            console.error("[migrate] falhou", row.id, modId, att.id, e);
            localFailed++;
          }
        }
      }
      if (localMigrated > 0) {
        row.data.modules = modules;
        const { error: updErr } = await supabaseAdmin
          .from("surveys")
          .update({ data: row.data as unknown as never, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        if (updErr) {
          console.error("[migrate] update falhou", row.id, updErr);
          localFailed += localMigrated;
        }
      }
      results.push({ surveyId: row.id, migrated: localMigrated, failed: localFailed });
    }

    return {
      processed: candidates.length,
      migratedAttachments,
      remaining: Math.max(0, (rows?.length ?? 0) - candidates.length),
      results,
    };
  });
