import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { migrateAttachmentsBatch } from "@/lib/migrateAttachments.functions";

export const Route = createFileRoute("/manutencao")({
  component: ManutencaoPage,
});

interface LogLine {
  at: string;
  text: string;
}

function ManutencaoPage() {
  const migrate = useServerFn(migrateAttachmentsBatch);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [totalMigrated, setTotalMigrated] = useState(0);

  function push(text: string) {
    setLog((l) => [...l, { at: new Date().toLocaleTimeString(), text }]);
  }

  async function runOnce() {
    setRunning(true);
    try {
      const res = await migrate({ data: { limit: 3 } });
      setTotalMigrated((n) => n + res.migratedAttachments);
      push(`Lote: ${res.processed} levantamentos, ${res.migratedAttachments} anexos migrados.`);
      res.results.forEach((r) => push(`  • ${r.surveyId}: ${r.migrated} ok, ${r.failed} falhas`));
      return res.processed;
    } catch (e) {
      push(`Erro: ${(e as Error).message}`);
      return 0;
    } finally {
      setRunning(false);
    }
  }

  async function runAll() {
    setRunning(true);
    setLog([]);
    setTotalMigrated(0);
    try {
      for (let i = 0; i < 40; i++) {
        const processed = await runOnce();
        if (processed === 0) {
          push("Nenhum levantamento com base64 restante. Migração concluída.");
          break;
        }
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Migração de fotos para Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Move as fotos antigas (embutidas em base64 no levantamento) para o bucket privado
              <code className="mx-1 rounded bg-muted px-1">survey-photos</code>. Isso resolve o
              travamento ao digitar e o &ldquo;sumiço&rdquo; de levantamento em campo. Rode até
              aparecer &ldquo;Migração concluída&rdquo;.
            </p>
            <div className="flex gap-2">
              <Button onClick={runAll} disabled={running}>
                {running ? "Migrando…" : "Migrar tudo"}
              </Button>
              <Button variant="outline" onClick={runOnce} disabled={running}>
                Migrar 3 levantamentos
              </Button>
            </div>
            <p className="text-sm">Total de anexos migrados nesta sessão: <strong>{totalMigrated}</strong></p>
            <div className="max-h-96 overflow-auto rounded border border-border bg-muted/40 p-3 font-mono text-xs">
              {log.length === 0 ? (
                <span className="text-muted-foreground">Sem execuções ainda.</span>
              ) : (
                log.map((l, i) => (
                  <div key={i}>
                    <span className="text-muted-foreground">[{l.at}]</span> {l.text}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
