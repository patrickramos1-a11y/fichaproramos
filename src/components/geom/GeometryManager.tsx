import { useMemo, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Pencil, Download, CheckCircle2, X, Spline, Hexagon, ChevronDown, ChevronUp, Map as MapIcon, FileArchive, Tags, MessageSquarePlus, CirclePlus, Building2, Waves, Factory, Landmark, Trees, Route, Droplets, Workflow, Warehouse, ShieldAlert, CircleDot } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DraftVertex } from "./MapView";
import { GpsCaptureDialog, type CapturedGpsPoint } from "./GpsCaptureDialog";
import { polygonAreaMeters, lineLengthMeters, formatArea, formatLength } from "@/lib/geoMath";
import { newGeometryId, type GeometryKind, type SurveyGeometry } from "@/lib/geometryTypes";

const MapView = lazy(() => import("./MapView").then((m) => ({ default: m.MapView })));
const loadKml = () => import("@/lib/kmlExport");
const exportKml = (name: string, geoms: SurveyGeometry[]) => loadKml().then((m) => m.downloadKml(name, geoms));
const exportKmz = (name: string, geoms: SurveyGeometry[]) => loadKml().then((m) => m.downloadKmz(name, geoms));
const exportSingleKml = (g: SurveyGeometry) => loadKml().then((m) => m.downloadSingleKml(g));

interface Props {
  value?: SurveyGeometry[];
  onChange: (next: SurveyGeometry[]) => void;
  only?: GeometryKind;
  exportName?: string;
  disabled?: boolean;
}

const MODES: { value: GeometryKind; label: string; icon: typeof MapPin }[] = [
  { value: "point", label: "Ponto", icon: MapPin },
  { value: "line", label: "Linha", icon: Spline },
  { value: "polygon", label: "Poligono", icon: Hexagon },
];

const GEOMETRY_TYPE_LIBRARY: Record<GeometryKind, string[]> = {
  point: ["Sede", "Poco", "Posto de monitoramento", "Central de residuos", "Lagoa", "Ponto de lancamento", "Ponto de captacao", "Reservatorio", "Entrada/acesso", "Outro"],
  line: ["Linha de estrada", "Linha de efluente", "Linha de tubulacao", "Linha de drenagem", "Caminho da agua", "Escoamento de efluentes", "Escoamento irregular", "Linha de campo", "Vala de infiltracao", "Vala de contencao", "Outro"],
  polygon: ["Area de galpao", "Area de lagoa", "Area de APP", "Area construida", "Area de vala de contencao", "Area de disposicao", "Area de vegetacao", "Area de intervencao", "Outro"],
};

const LIBRARY_STORAGE_KEY = "fpr.geometry.customTypes.v1";
const KIND_TONE: Record<GeometryKind, string> = {
  point: "border-emerald-200 bg-emerald-50 text-emerald-900",
  line: "border-sky-200 bg-sky-50 text-sky-900",
  polygon: "border-amber-200 bg-amber-50 text-amber-900",
};

const KIND_CODE_PREFIX: Record<GeometryKind, string> = { point: "P", line: "L", polygon: "A" };
const KIND_LABEL: Record<GeometryKind, string> = { point: "Ponto", line: "Linha", polygon: "Poligono/area" };

const TYPE_PRESENTATION: Record<string, { icon: typeof MapPin; tone: string }> = {
  "Sede": { icon: Building2, tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  "Poco": { icon: Droplets, tone: "border-sky-300 bg-sky-50 text-sky-800" },
  "Posto de monitoramento": { icon: CircleDot, tone: "border-violet-300 bg-violet-50 text-violet-800" },
  "Central de residuos": { icon: Factory, tone: "border-amber-300 bg-amber-50 text-amber-800" },
  "Lagoa": { icon: Waves, tone: "border-cyan-300 bg-cyan-50 text-cyan-800" },
  "Ponto de lancamento": { icon: Droplets, tone: "border-rose-300 bg-rose-50 text-rose-800" },
  "Ponto de captacao": { icon: Landmark, tone: "border-blue-300 bg-blue-50 text-blue-800" },
  "Reservatorio": { icon: Warehouse, tone: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  "Entrada/acesso": { icon: Route, tone: "border-slate-300 bg-slate-50 text-slate-800" },
  "Linha de estrada": { icon: Route, tone: "border-stone-300 bg-stone-50 text-stone-800" },
  "Linha de efluente": { icon: Workflow, tone: "border-rose-300 bg-rose-50 text-rose-800" },
  "Linha de tubulacao": { icon: Workflow, tone: "border-indigo-300 bg-indigo-50 text-indigo-800" },
  "Linha de drenagem": { icon: Droplets, tone: "border-sky-300 bg-sky-50 text-sky-800" },
  "Caminho da agua": { icon: Waves, tone: "border-cyan-300 bg-cyan-50 text-cyan-800" },
  "Escoamento de efluentes": { icon: Workflow, tone: "border-red-300 bg-red-50 text-red-800" },
  "Escoamento irregular": { icon: ShieldAlert, tone: "border-orange-300 bg-orange-50 text-orange-800" },
  "Linha de campo": { icon: Route, tone: "border-lime-300 bg-lime-50 text-lime-800" },
  "Vala de infiltracao": { icon: Droplets, tone: "border-teal-300 bg-teal-50 text-teal-800" },
  "Vala de contencao": { icon: ShieldAlert, tone: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  "Area de galpao": { icon: Warehouse, tone: "border-slate-300 bg-slate-50 text-slate-800" },
  "Area de lagoa": { icon: Waves, tone: "border-cyan-300 bg-cyan-50 text-cyan-800" },
  "Area de APP": { icon: Trees, tone: "border-green-300 bg-green-50 text-green-800" },
  "Area construida": { icon: Building2, tone: "border-zinc-300 bg-zinc-50 text-zinc-800" },
  "Area de vala de contencao": { icon: ShieldAlert, tone: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  "Area de disposicao": { icon: Factory, tone: "border-amber-300 bg-amber-50 text-amber-800" },
  "Area de vegetacao": { icon: Trees, tone: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  "Area de intervencao": { icon: Landmark, tone: "border-rose-300 bg-rose-50 text-rose-800" },
};

function presentationForType(typeLabel?: string, kind?: GeometryKind) {
  const match = typeLabel ? TYPE_PRESENTATION[typeLabel] : undefined;
  if (match) return match;
  if (kind === "line") return { icon: Spline, tone: "border-sky-300 bg-sky-50 text-sky-800" };
  if (kind === "polygon") return { icon: Hexagon, tone: "border-amber-300 bg-amber-50 text-amber-800" };
  return { icon: MapPin, tone: "border-emerald-300 bg-emerald-50 text-emerald-800" };
}

function geometryCode(g: SurveyGeometry, index: number) {
  if (g.code) return g.code;
  if (g.kind === "point" && /^P\d+$/i.test(g.name || "")) return g.name.toUpperCase();
  return `${KIND_CODE_PREFIX[g.kind]}${index + 1}`;
}

function descriptiveName(g: SurveyGeometry, code: string) {
  if (g.typeLabel) return g.name && g.name !== code ? g.name : g.typeLabel;
  if (!g.name || g.name === code) return "";
  return g.name;
}

function titleForGeometry(g: SurveyGeometry, index: number) {
  const code = geometryCode(g, index);
  const name = descriptiveName(g, code);
  const base = name ? `${code} - ${name}` : code;
  return g.customName ? `${base} - ${g.customName}` : base;
}

function decimalPoint(g: SurveyGeometry) {
  if (g.kind !== "point" || !g.geojson?.coordinates) return "";
  const [lng, lat] = g.geojson.coordinates;
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function toDms(value: number, positive: string, negative: string) {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${deg}\u00b0${min}'${sec.toFixed(1)}"${value >= 0 ? positive : negative}`;
}

function pointDms(g: SurveyGeometry) {
  if (g.kind !== "point" || !g.geojson?.coordinates) return "";
  const [lng, lat] = g.geojson.coordinates;
  return `${toDms(Number(lat), "N", "S")}, ${toDms(Number(lng), "E", "W")}`;
}

function formatDateTime(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function vertexCount(g: SurveyGeometry) {
  if (g.kind === "point") return 1;
  if (g.kind === "line") return g.geojson?.coordinates?.length ?? 0;
  return g.geojson?.coordinates?.[0]?.length ?? 0;
}

export function GeometryManager({ value, onChange, only, exportName = "geometrias", disabled }: Props) {
  const geometries = value || [];
  const [mode, setMode] = useState<GeometryKind>(only || "point");
  const [draft, setDraft] = useState<DraftVertex[]>([]);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<"name" | "description" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editing, setEditing] = useState<SurveyGeometry | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [customTypeOpen, setCustomTypeOpen] = useState(false);
  const [customTypeName, setCustomTypeName] = useState("");
  const [selectedType, setSelectedType] = useState("Outro");
  const [customTypes, setCustomTypes] = useState<Record<GeometryKind, string[]>>(() => {
    try {
      if (typeof window === "undefined") return { point: [], line: [], polygon: [] };
      const parsed = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY) || "{}");
      return { point: parsed.point || [], line: parsed.line || [], polygon: parsed.polygon || [] };
    } catch {
      return { point: [], line: [], polygon: [] };
    }
  });

  const activeMode = only || mode;
  const visibleGeoms = only ? geometries.filter((g) => g.kind === only) : geometries;
  const draftPreview = useMemo(() => ({ mode: activeMode, vertices: draft }), [activeMode, draft]);

  const addGeometry = (g: SurveyGeometry) => onChange([...geometries, g]);
  const updateGeometry = (id: string, patch: Partial<SurveyGeometry>) => onChange(geometries.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const removeGeometry = (id: string) => onChange(geometries.filter((g) => g.id !== id));
  const nextCode = (kind: GeometryKind) => `${KIND_CODE_PREFIX[kind]}${geometries.filter((g) => g.kind === kind).length + 1}`;
  const suggestedName = (kind: GeometryKind, typeLabel: string) => {
    if (!typeLabel || typeLabel === "Outro") return "";
    const total = geometries.filter((g) => g.kind === kind && ((g.typeLabel || "") === typeLabel || (g.name || "").startsWith(typeLabel))).length;
    return total > 0 ? `${typeLabel} ${total + 1}` : typeLabel;
  };

  const libraryForMode = [...GEOMETRY_TYPE_LIBRARY[activeMode], ...customTypes[activeMode]];

  const beginCapture = (typeLabel: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocalizacao nao suportada neste dispositivo");
      return;
    }
    setSelectedType(typeLabel);
    setTypePickerOpen(false);
    setCaptureOpen(true);
  };

  const saveCustomType = () => {
    const name = customTypeName.trim();
    if (!name) return;
    setCustomTypes((prev) => {
      const next = { ...prev, [activeMode]: [...prev[activeMode], name] };
      if (typeof window !== "undefined") localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setCustomTypeName("");
    setCustomTypeOpen(false);
  };

  const handleCaptured = (cp: CapturedGpsPoint) => {
    if (activeMode === "point") {
      const code = nextCode("point");
      const typeLabel = selectedType || "Outro";
      addGeometry({
        id: newGeometryId(),
        kind: "point",
        code,
        typeLabel,
        name: suggestedName("point", typeLabel),
        geojson: { type: "Point", coordinates: [cp.longitude, cp.latitude] },
        accuracy: cp.accuracy,
        precision_quality: cp.precision_quality,
        captured_at: cp.captured_at,
        created_at: new Date().toISOString(),
        area_m2: null,
        length_m: null,
      });
      toast.success(`${code} salvo`);
      return;
    }
    setDraft((prev) => [...prev, { lat: cp.latitude, lng: cp.longitude, number: prev.length + 1 }]);
    toast.success(`P${draft.length + 1} adicionado ao rascunho`);
  };

  const removeDraftVertex = (n: number) => {
    setDraft((prev) => prev.filter((v) => v.number !== n).map((v, i) => ({ ...v, number: i + 1 })));
  };

  const openClose = () => {
    if (activeMode === "polygon" && draft.length < 3) { toast.error("Adicione pelo menos 3 pontos para fechar o poligono."); return; }
    if (activeMode === "line" && draft.length < 2) { toast.error("Adicione pelo menos 2 pontos para criar uma linha."); return; }
    commitDraft();
  };

  const commitDraft = () => {
    if (!draft.length) return;
    const coords: [number, number][] = draft.map((v) => [v.lng, v.lat]);
    let geojson: any;
    let area_m2: number | null = null;
    let length_m: number | null = null;
    if (activeMode === "polygon") {
      const ring = [...coords, coords[0]];
      geojson = { type: "Polygon", coordinates: [ring] };
      area_m2 = polygonAreaMeters(coords);
      length_m = lineLengthMeters(ring);
    } else {
      geojson = { type: "LineString", coordinates: coords };
      length_m = lineLengthMeters(coords);
    }
    addGeometry({
      id: newGeometryId(),
      kind: activeMode,
      code: nextCode(activeMode),
      typeLabel: selectedType || "Outro",
      name: suggestedName(activeMode, selectedType || "Outro"),
      geojson,
      area_m2,
      length_m,
      created_at: new Date().toISOString(),
    });
    toast.success(activeMode === "polygon" ? "Poligono salvo" : "Linha salva");
    setDraft([]);
  };

  const saveEdit = () => {
    if (!editing) return;
    const value = editValue.trim();
    updateGeometry(editing.id, editOpen === "name" ? { customName: value || undefined } : { description: value || undefined });
    setEditing(null);
    setEditOpen(null);
  };

  const groups = only ? [only] : (["point", "line", "polygon"] as GeometryKind[]);
  const standardLabel = "Padroes";

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Captura GPS / Mapa</span>
        {visibleGeoms.length > 0 && (
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => exportKml(exportName, visibleGeoms)}>
              <Download className="h-3.5 w-3.5 mr-1" /> KML
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => exportKmz(exportName, visibleGeoms)}>
              <FileArchive className="h-3.5 w-3.5 mr-1" /> KMZ
            </Button>
          </div>
        )}
      </div>

      {!only && (
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = activeMode === m.value;
            return (
              <button key={m.value} type="button" disabled={disabled}
                onClick={() => {
                  if (draft.length && m.value !== activeMode) {
                    if (!confirm("Descartar pontos do rascunho atual?")) return;
                    setDraft([]);
                  }
                  setMode(m.value);
                }}
                className={cn("flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors min-w-0", active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-background")}>
                <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          onClick={() => beginCapture(draft.length ? selectedType : "Outro")}
          disabled={disabled}
          className="h-11"
          title={activeMode === "point" ? "Capturar ponto" : activeMode === "line" ? "Capturar ponto da linha" : "Capturar ponto da area"}
        >
          <Plus className="h-4 w-4 mr-2" /> Capturar
        </Button>
        {!draft.length && (
          <Button type="button" variant="outline" onClick={() => setTypePickerOpen(true)} disabled={disabled} className="h-11 px-3" title="Abrir biblioteca de padroes">
            <Tags className="h-4 w-4 mr-1" /> {standardLabel}
          </Button>
        )}
      </div>

      {(activeMode === "polygon" || activeMode === "line") && draft.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-warn-soft p-2 space-y-2">
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="font-medium text-warn-foreground">Rascunho - {draft.length} ponto{draft.length > 1 ? "s" : ""}</span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setDraft([])}><X className="h-3 w-3 mr-1" /> Cancelar</Button>
              <Button type="button" size="sm" className="h-7 text-[11px]" onClick={openClose}>
                <CheckCircle2 className="h-3 w-3 mr-1" />{activeMode === "polygon" ? "Fechar" : "Salvar"}
              </Button>
            </div>
          </div>
          <ul className="text-[11px] space-y-0.5">
            {draft.map((v) => (
              <li key={v.number} className="flex items-center justify-between gap-2 font-mono">
                <span className="break-all">P{v.number} - {v.lat.toFixed(5)}, {v.lng.toFixed(5)}</span>
                <button type="button" onClick={() => removeDraftVertex(v.number)} className="text-warn-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <button type="button" onClick={() => setMapOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40">
          <span className="flex items-center gap-1.5 min-w-0">
            <MapIcon className="h-3.5 w-3.5 shrink-0" />Mapa
            {(visibleGeoms.length > 0 || draft.length > 0) && <span className="text-muted-foreground font-normal truncate">- {visibleGeoms.length + (draft.length > 0 ? 1 : 0)} elemento(s)</span>}
          </span>
          {mapOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {mapOpen && (
          <div className="p-2 pt-0">
            <Suspense fallback={<div className="h-[280px] bg-muted/40 rounded animate-pulse" />}>
              <MapView geometries={visibleGeoms} draft={draftPreview} height={280} />
            </Suspense>
            <p className="text-[10px] text-muted-foreground mt-1 italic text-center">Tiles do mapa precisam de internet. Coordenadas sao salvas e funcionam offline.</p>
          </div>
        )}
      </div>

      {groups.map((t) => {
        const list = geometries.filter((g) => g.kind === t);
        if (!list.length) return null;
        const title = t === "point" ? "Pontos" : t === "line" ? "Linhas" : "Poligonos";
        return (
          <div key={t} className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{title} - {list.length}</div>
            <ul className="space-y-1.5">
              {list.map((g, index) => {
                const code = geometryCode(g, index);
                const presentation = presentationForType(g.typeLabel, g.kind);
                const ItemIcon = presentation.icon;
                return (
                  <li key={g.id} className={cn("rounded-md border px-2.5 py-2 text-xs", presentation.tone)}>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80">
                            <ItemIcon className="h-3 w-3" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold break-words">{titleForGeometry(g, index)}</div>
                            {g.typeLabel && <div className="text-[10px] font-medium opacity-80">{g.typeLabel}</div>}
                          </div>
                        </div>
                        {g.description && <p className="text-[11px] text-foreground/80 line-clamp-2 break-words">{g.description}</p>}
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          {g.kind === "point" && <span className="font-mono break-all">{decimalPoint(g)}</span>}
                          {g.kind === "point" && <span className="font-mono break-all">{pointDms(g)}</span>}
                          {g.area_m2 != null && <span>{formatArea(g.area_m2)}</span>}
                          {g.length_m != null && <span>{formatLength(g.length_m)}</span>}
                          {g.kind !== "point" && <span>{vertexCount(g)} ponto(s)</span>}
                          {g.accuracy != null && <span>+/-{Math.round(g.accuracy)}m</span>}
                          {(g.captured_at || g.created_at) && <span>{formatDateTime(g.captured_at || g.created_at)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-0.5 shrink-0 max-w-[7rem]">
                        <button type="button" onClick={() => exportSingleKml(g)} className="h-8 w-8 rounded flex items-center justify-center text-primary hover:bg-primary/10" title={`Exportar ${code} em KML`}><Download className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setEditing(g); setEditOpen("name"); setEditValue(g.customName || ""); }} className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:bg-muted" title={g.customName ? "Editar nome complementar" : "Adicionar nome"}><Pencil className="h-3.5 w-3.5" /></button>
                        {g.customName && (
                          <button type="button" onClick={() => { setEditing(g); setEditOpen("description"); setEditValue(g.description || ""); }} className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:bg-muted" title={g.description ? "Editar descricao" : "Adicionar descricao"}><MessageSquarePlus className="h-3.5 w-3.5" /></button>
                        )}
                        <button type="button" onClick={() => { if (confirm(`Excluir ${titleForGeometry(g, index)}?`)) removeGeometry(g.id); }} className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Excluir"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <GpsCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} onSave={handleCaptured} />

      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="top-4 translate-y-0 max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader><DialogTitle>{standardLabel}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {libraryForMode.map((item) => (
              (() => {
                const presentation = presentationForType(item, activeMode);
                const ItemIcon = presentation.icon;
                return (
                  <button
                    key={item}
                    type="button"
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-left text-xs font-medium shadow-sm", presentation.tone)}
                    onClick={() => beginCapture(item)}
                  >
                    <ItemIcon className="h-3.5 w-3.5" />
                    {item}
                  </button>
                );
              })()
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary"
              onClick={() => setCustomTypeOpen(true)}
            >
              <CirclePlus className="h-3.5 w-3.5" />
              Novo padrao
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={customTypeOpen} onOpenChange={setCustomTypeOpen}>
        <DialogContent className="top-4 translate-y-0 max-w-sm p-4 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader><DialogTitle>Novo padrao</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-[11px] font-medium">Nome do padrao</label>
            <Input value={customTypeName} onChange={(e) => setCustomTypeName(e.target.value)} className="h-9" placeholder="Ex.: Caixa separadora, vala de contencao" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCustomTypeOpen(false)}>Cancelar</Button>
            <Button onClick={saveCustomType}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="top-4 translate-y-0 max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader><DialogTitle>{editOpen === "description" ? "Adicionar descricao" : "Adicionar nome"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <div>ID: <span className="font-semibold text-foreground">{geometryCode(editing, geometries.filter((g) => g.kind === editing.kind).findIndex((g) => g.id === editing.id))}</span></div>
                <div>Padrao: <span className="font-semibold text-foreground">{descriptiveName(editing, geometryCode(editing, 0)) || KIND_LABEL[editing.kind]}</span></div>
                {editing.kind === "point" && <div>Decimal: <span className="font-mono text-foreground">{decimalPoint(editing)}</span></div>}
                {editing.kind === "point" && <div>GMS: <span className="font-mono text-foreground">{pointDms(editing)}</span></div>}
                {editing.accuracy != null && <div>Precisao: <span className="text-foreground">+/-{Math.round(editing.accuracy)}m</span></div>}
                {(editing.captured_at || editing.created_at) && <div>Data/hora: <span className="text-foreground">{formatDateTime(editing.captured_at || editing.created_at)}</span></div>}
              </div>
              {editOpen === "description" ? (
                <div>
                  <label className="text-[11px] font-medium">Descricao</label>
                  <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-medium">Nome complementar</label>
                  <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-9" placeholder="Ex.: proximo ao reservatorio" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
