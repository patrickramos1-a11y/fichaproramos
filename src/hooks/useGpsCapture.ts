import { useCallback, useEffect, useRef, useState } from "react";

export type PrecisionQuality = "excelente" | "boa" | "aceitavel" | "baixa";

export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GpsCaptureState {
  status: "idle" | "capturing" | "done" | "error";
  readings: GpsReading[];
  current: GpsReading | null;
  best: GpsReading | null;
  elapsedSeconds: number;
  error: string | null;
  quality: PrecisionQuality | null;
}

export interface GpsCaptureOptions {
  /** Tempo máximo em segundos (10-30, padrão 20) */
  maxSeconds?: number;
  /** Precisão (m) abaixo da qual a captura encerra automaticamente */
  autoStopAccuracy?: number;
}

export function classifyAccuracy(acc: number | null | undefined): PrecisionQuality | null {
  if (acc == null || !isFinite(acc)) return null;
  if (acc <= 5) return "excelente";
  if (acc <= 10) return "boa";
  if (acc <= 20) return "aceitavel";
  return "baixa";
}

export const QUALITY_LABEL: Record<PrecisionQuality, string> = {
  excelente: "Excelente",
  boa: "Boa",
  aceitavel: "Aceitável",
  baixa: "Baixa",
};

export const QUALITY_COLOR: Record<PrecisionQuality, string> = {
  excelente: "bg-primary/15 text-primary border-primary/30",
  boa: "bg-primary/10 text-primary border-primary/25",
  aceitavel: "bg-warn-soft text-warn-foreground border-warn/40",
  baixa: "bg-destructive/10 text-destructive border-destructive/30",
};

export function useGpsCapture(opts: GpsCaptureOptions = {}) {
  const maxSeconds = Math.min(30, Math.max(10, opts.maxSeconds ?? 20));
  const autoStopAccuracy = opts.autoStopAccuracy ?? 8;

  const [state, setState] = useState<GpsCaptureState>({
    status: "idle",
    readings: [],
    current: null,
    best: null,
    elapsedSeconds: 0,
    error: null,
    quality: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState((s) => ({
      ...s,
      status: s.status === "capturing" ? "done" : s.status,
      quality: classifyAccuracy(s.best?.accuracy),
    }));
  }, [cleanup]);

  const cancel = useCallback(() => {
    cleanup();
    setState({
      status: "idle",
      readings: [],
      current: null,
      best: null,
      elapsedSeconds: 0,
      error: null,
      quality: null,
    });
  }, [cleanup]);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, status: "error", error: "Geolocalização não suportada" }));
      return;
    }
    cleanup();
    startedAtRef.current = Date.now();
    setState({
      status: "capturing",
      readings: [],
      current: null,
      best: null,
      elapsedSeconds: 0,
      error: null,
      quality: null,
    });

    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setState((s) => ({ ...s, elapsedSeconds: elapsed }));
      if (elapsed >= maxSeconds) {
        cleanup();
        setState((s) => ({
          ...s,
          status: "done",
          elapsedSeconds: elapsed,
          quality: classifyAccuracy(s.best?.accuracy),
        }));
      }
    }, 250);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const r: GpsReading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude ?? null,
          altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          timestamp: pos.timestamp,
        };
        setState((s) => {
          const readings = [...s.readings, r];
          const best = !s.best || r.accuracy < s.best.accuracy ? r : s.best;
          // Auto-stop quando atinge precisão excelente/boa
          if (best.accuracy <= autoStopAccuracy) {
            cleanup();
            return {
              ...s,
              readings,
              current: r,
              best,
              status: "done",
              quality: classifyAccuracy(best.accuracy),
            };
          }
          return { ...s, readings, current: r, best, quality: classifyAccuracy(best.accuracy) };
        });
      },
      (err) => {
        cleanup();
        const msg =
          err.code === 1
            ? "Não foi possível acessar sua localização. Verifique a permissão de GPS do navegador."
            : err.code === 3
              ? "Tempo esgotado ao buscar GPS."
              : "Não foi possível obter coordenadas.";
        setState((s) => ({ ...s, status: "error", error: msg }));
      },
      { enableHighAccuracy: true, timeout: maxSeconds * 1000, maximumAge: 0 },
    );
  }, [cleanup, maxSeconds, autoStopAccuracy]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { state, start, stop, cancel, maxSeconds };
}
