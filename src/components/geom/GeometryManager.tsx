import { useMemo, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2, Pencil, Download, CheckCircle2, X, Spline, Hexagon, ChevronDown, ChevronUp, Map as MapIcon, FileArchive } from "lucide-react";
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

const KIND_CODE_PREFIX: Record<GeometryKind, string> = { point: "P", line: "L", polygon: "A" };
const KIND_LABEL: Record<GeometryKind, string> = { point: "Ponto", line: "Linha", polygon: "Poligono/area" };

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
  return name ? `${code} - ${name}` : code;
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
  const [namingOpen, setNamingOpen] = useState(false);
  const [namingForm, setNamingForm] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState<SurveyGeometry | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("Outro");

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

  const beginCapture = (typeLabel: string) => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocalizacao nao suportada neste dispositivo");
      return;
    }
    setSelectedType(typeLabel);
    setTypePickerOpen(false);
    setCaptureOpen(true);
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
    const typeLabel = selectedType || "Outro";
    setNamingForm({ name: suggestedName(activeMode, typeLabel), description: "" });
    setNamingOpen(true);
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
      name: namingForm.name.trim() || suggestedName(activeMode, selectedType || "Outro"),
      description: namingForm.description.trim() || undefined,
      geojson,
      area_m2,
      length_m,
      created_at: new Date().toISOString(),
    });
    toast.success(activeMode === "polygon" ? "Poligono salvo" : "Linha salva");
    setDraft([]);
    setNamingOpen(false);
  };

  const saveEdit = () => {
    if (!editing) return;
    updateGeometry(editing.id, { name: namingForm.name.trim(), description: namingForm.description.trim() || undefined });
    setEditing(null);
  };

  const groups = only ? [only] : (["point", "line", "polygon"] as GeometryKind[]);
  const addLabel = activeMode === "point" ? "Adicionar ponto" : activeMode === "line" ? "Adicionar linha" : "Adicionar poligono/area";

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

      <Button type="button" onClick={() => setTypePickerOpen(true)} disabled={disabled} className="w-full h-11">
        <Plus className="h-4 w-4 mr-2" /> {addLabel}
      </Button>

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
                return (
                  <li key={g.id} className="rounded-md border bg-card px-2.5 py-2 text-xs">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{titleForGeometry(g, index)}</div>
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
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" onClick={() => exportSingleKml(g)} className="h-8 w-8 rounded flex items-center justify-center text-primary hover:bg-primary/10" title={`Exportar ${code} em KML`}><Download className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => { setEditing(g); setNamingForm({ name: descriptiveName(g, code), description: g.description || "" }); }} className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:bg-muted" title="Editar"><Pencil className="h-3.5 w-3.5" /></button>
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
          <DialogHeader><DialogTitle>Adicionar {KIND_LABEL[activeMode]}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {GEOMETRY_TYPE_LIBRARY[activeMode].map((item) => (
              <button key={item} type="button" className="rounded-md border px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => beginCapture(item)}>
                {item}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={namingOpen} onOpenChange={setNamingOpen}>
        <DialogContent className="top-4 translate-y-0 max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader><DialogTitle>{activeMode === "polygon" ? "Fechar poligono" : "Salvar linha"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
              <div>ID: <span className="font-semibold text-foreground">{nextCode(activeMode)}</span></div>
              <div>Tipo: <span className="font-semibold text-foreground">{selectedType}</span></div>
            </div>
            <div>
              <label className="text-[11px] font-medium">Nome descritivo</label>
              <Input value={namingForm.name} onChange={(e) => setNamingForm((f) => ({ ...f, name: e.target.value }))} className="h-9" placeholder="Opcional" />
            </div>
            <div>
              <label className="text-[11px] font-medium">Descricao</label>
              <Textarea value={namingForm.description} onChange={(e) => setNamingForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            {activeMode === "polygon" && draft.length >= 3 && <div className="text-xs text-muted-foreground">Area estimada: {formatArea(polygonAreaMeters(draft.map((v) => [v.lng, v.lat])))}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNamingOpen(false)}>Cancelar</Button>
            <Button onClick={commitDraft}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="top-4 translate-y-0 max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:top-[50%] sm:translate-y-[-50%]">
          <DialogHeader><DialogTitle>Editar geometria</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <div>ID: <span className="font-semibold text-foreground">{geometryCode(editing, geometries.filter((g) => g.kind === editing.kind).findIndex((g) => g.id === editing.id))}</span></div>
                <div>Tipo: <span className="font-semibold text-foreground">{KIND_LABEL[editing.kind]}</span></div>
                {editing.kind === "point" && <div>Decimal: <span className="font-mono text-foreground">{decimalPoint(editing)}</span></div>}
                {editing.kind === "point" && <div>GMS: <span className="font-mono text-foreground">{pointDms(editing)}</span></div>}
                {editing.accuracy != null && <div>Precisao: <span className="text-foreground">+/-{Math.round(editing.accuracy)}m</span></div>}
                {(editing.captured_at || editing.created_at) && <div>Data/hora: <span className="text-foreground">{formatDateTime(editing.captured_at || editing.created_at)}</span></div>}
              </div>
              <div>
                <label className="text-[11px] font-medium">Nome descritivo</label>
                <Input value={namingForm.name} onChange={(e) => setNamingForm((f) => ({ ...f, name: e.target.value }))} className="h-9" placeholder="Ex.: Poco, Lagoa, Central de residuos" />
              </div>
              <div>
                <label className="text-[11px] font-medium">Descricao</label>
                <Textarea value={namingForm.description} onChange={(e) => setNamingForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
              </div>
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
