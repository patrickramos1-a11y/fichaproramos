import { useEffect, useState } from "react";
import { Database, Wifi, WifiOff, Loader2, RotateCw } from "lucide-react";
import { retryPendingSync, useDBStatus } from "@/lib/store";

export function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const status = useDBStatus();
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const annualUnavailable = status.annualRecordsAvailable === false;
  const showStatus = !online || status.persistPending || !!status.persistenceError || annualUnavailable;

  const hardReload = () => {
    try {
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      sessionStorage.removeItem("chunk-reload-once");
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5">
      {showStatus && (
        <div
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border"
          title={status.persistenceError || status.annualRecordsError || ""}
        >
          {!online ? <><WifiOff className="h-3.5 w-3.5 text-warn-foreground" /><span className="text-warn-foreground">Offline</span></>
            : status.persistenceError ? <><Wifi className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Erro de sincronia</span></>
            : status.persistPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Salvando…</span></>
            : <><Database className="h-3.5 w-3.5 text-amber-700" /><span className="text-amber-700">Banco anual nao configurado</span></>}
          {status.persistenceError && online && (
            <button
              type="button"
              onClick={retryPendingSync}
              className="ml-1 rounded border px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
              title={`Tentar reenviar ${status.pendingOperations ?? 0} operacao(oes) pendente(s)`}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={hardReload}
        title="Recarregar app (limpa cache local)"
        aria-label="Recarregar app"
        className="inline-flex items-center justify-center h-7 w-7 rounded-md border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <RotateCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
