import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Loader2, RotateCcw, Check, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGpsCapture, classifyAccuracy, QUALITY_LABEL, QUALITY_COLOR, type GpsReading, type PrecisionQuality } from "@/hooks/useGpsCapture";

export interface CapturedGpsPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  captured_at: string;
  capture_duration_seconds: number;
  readings_count: number;
  best_accuracy: number;
  precision_quality: PrecisionQuality;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (point: CapturedGpsPoint) => void;
  maxSeconds?: number;
}

export function GpsCaptureDialog({ open, onOpenChange, onSave, maxSeconds = 20 }: Props) {
  const { state, start, cancel } = useGpsCapture({ maxSeconds });

  useEffect(() => {
    if (open) start();
    else cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const elapsed = Math.min(state.elapsedSeconds, maxSeconds);
  const progress = (elapsed / maxSeconds) * 100;
  const currentQ = classifyAccuracy(state.current?.accuracy);
  const bestQ = state.quality;

  const handleSave = (reading: GpsReading) => {
    const q = classifyAccuracy(reading.accuracy) ?? "baixa";
    onSave({
      latitude: reading.latitude,
      longitude: reading.longitude,
      accuracy: reading.accuracy,
      altitude: reading.altitude,
      captured_at: new Date(reading.timestamp).toISOString(),
      capture_duration_seconds: Math.round(state.elapsedSeconds * 10) / 10,
      readings_count: state.readings.length,
      best_accuracy: state.best?.accuracy ?? reading.accuracy,
      precision_quality: q,
    });
    onOpenChange(false);
  };

  const handleClose = () => { cancel(); onOpenChange(false); };
  const isCapturing = state.status === "capturing";
  const isDone = state.status === "done";
  const isError = state.status === "error";
  const lowQuality = state.best && state.best.accuracy > 20;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Captura GPS estabilizada
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isCapturing ? (<><Loader2 className="h-4 w-4 animate-spin text-primary" />Buscando melhor precisão...</>) : isDone ? (<><Check className="h-4 w-4 text-primary" />Captura concluída</>) : null}
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Tempo: {elapsed.toFixed(0)}s / {maxSeconds}s</span>
                <span>Leituras: {state.readings.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ReadingCard label="Precisão atual" accuracy={state.current?.accuracy ?? null} quality={currentQ} />
                <ReadingCard label="Melhor precisão" accuracy={state.best?.accuracy ?? null} quality={bestQ} highlight />
              </div>
              {state.best && (
                <div className="text-[11px] font-mono text-muted-foreground text-center">
                  {state.best.latitude.toFixed(6)}, {state.best.longitude.toFixed(6)}
                  {state.best.altitude != null && (<> · alt {Math.round(state.best.altitude)}m</>)}
                </div>
              )}
              {isDone && lowQuality && (
                <div className="rounded-lg border border-warn/30 bg-warn-soft p-2 text-[12px] text-warn-foreground flex gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Precisão baixa. Tente em local aberto ou aguarde mais alguns segundos.
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={handleClose}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => start()} disabled={isCapturing}><RotateCcw className="h-4 w-4 mr-1" /> Tentar novamente</Button>
            <Button type="button" onClick={() => state.best && handleSave(state.best)} disabled={!state.best}>
              <Check className="h-4 w-4 mr-1" />{isCapturing ? "Salvar agora" : "Salvar ponto"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadingCard({ label, accuracy, quality, highlight }: { label: string; accuracy: number | null; quality: PrecisionQuality | null; highlight?: boolean; }) {
  return (
    <div className={cn("rounded-lg border p-2", highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30")}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{accuracy != null ? `±${accuracy.toFixed(1)} m` : "—"}</div>
      {quality && (
        <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded border", QUALITY_COLOR[quality])}>{QUALITY_LABEL[quality]}</span>
      )}
    </div>
  );
}