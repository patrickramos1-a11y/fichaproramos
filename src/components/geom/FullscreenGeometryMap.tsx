import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatArea, formatLength, lineLengthMeters, polygonAreaMeters } from "@/lib/geoMath";
import { newGeometryId, type GeometryKind, type SurveyGeometry } from "@/lib/geometryTypes";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Hexagon,
  Layers,
  LocateFixed,
  MapPin,
  RotateCcw,
  Save,
  Spline,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

type TypeLibrary = Record<GeometryKind, string[]>;

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  geometries: SurveyGeometry[];
  onSave: (geometries: SurveyGeometry[]) => void;
  typeLibrary: TypeLibrary;
  only?: GeometryKind;
}

type DraftVertex = { lat: number; lng: number; number: number };

const MODE_META: Record<GeometryKind, { label: string; icon: typeof MapPin; color: string; fill: string; prefix: string }> = {
  point: { label: "Ponto", icon: MapPin, color: "#059669", fill: "#10b981", prefix: "P" },
  line: { label: "Linha", icon: Spline, color: "#0284c7", fill: "#38bdf8", prefix: "L" },
  polygon: { label: "Poligono", icon: Hexagon, color: "#d97706", fill: "#fbbf24", prefix: "A" },
};

const LAYERS = {
  osm: { label: "Mapa", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "(c) OpenStreetMap" },
  sat: { label: "Satelite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles (c) Esri" },
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char));
}

function codeFor(g: SurveyGeometry, index: number) {
  if (g.code) return g.code;
  const prefix = MODE_META[g.kind].prefix;
  return `${prefix}${index + 1}`;
}

function titleFor(g: SurveyGeometry, index: number) {
  const code = codeFor(g, index);
  const base = g.typeLabel && g.typeLabel !== "Outro" ? g.typeLabel : g.name && g.name !== code ? g.name : "";
  const label = g.customName ? `${base ? `${base} - ` : ""}${g.customName}` : base;
  return label ? `${code} - ${label}` : code;
}

function coordsOf(g: SurveyGeometry): [number, number][] {
  if (g.kind === "point" && Array.isArray(g.geojson?.coordinates)) return [g.geojson.coordinates as [number, number]];
  if (g.kind === "line" && Array.isArray(g.geojson?.coordinates)) return g.geojson.coordinates as [number, number][];
  if (g.kind === "polygon" && Array.isArray(g.geojson?.coordinates?.[0])) {
    const ring = g.geojson.coordinates[0] as [number, number][];
    if (ring.length > 1) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
    }
    return ring;
  }
  return [];
}

function measureGeometry(kind: GeometryKind, coords: [number, number][]) {
  if (kind === "line") return { length_m: lineLengthMeters(coords), area_m2: null };
  if (kind === "polygon") {
    const ring = coords.length ? [...coords, coords[0]] : coords;
    return { length_m: lineLengthMeters(ring), area_m2: polygonAreaMeters(coords) };
  }
  return { length_m: null, area_m2: null };
}

function geometryWithCoords(g: SurveyGeometry, coords: [number, number][]): SurveyGeometry {
  if (g.kind === "point") {
    return {
      ...g,
      geojson: { type: "Point", coordinates: coords[0] },
    };
  }
  if (g.kind === "line") {
    return {
      ...g,
      geojson: { type: "LineString", coordinates: coords },
      ...measureGeometry("line", coords),
    };
  }
  const ring = coords.length ? [...coords, coords[0]] : coords;
  return {
    ...g,
    geojson: { type: "Polygon", coordinates: [ring] },
    ...measureGeometry("polygon", coords),
  };
}

function centerOf(g: SurveyGeometry): [number, number] | null {
  const coords = coordsOf(g);
  if (!coords.length) return null;
  if (g.kind === "point") return [coords[0][1], coords[0][0]];
  const sum = coords.reduce((acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }), { lat: 0, lng: 0 });
  return [sum.lat / coords.length, sum.lng / coords.length];
}

function summaryFor(g: SurveyGeometry) {
  if (g.kind === "point") {
    const coords = coordsOf(g)[0];
    return coords ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : "";
  }
  if (g.kind === "line") return g.length_m != null ? formatLength(g.length_m) : "";
  return [g.area_m2 != null ? formatArea(g.area_m2) : "", g.length_m != null ? formatLength(g.length_m) : ""].filter(Boolean).join(" - ");
}

function vertexIcon(active = false) {
  const size = active ? 30 : 24;
  return L.divIcon({
    className: "",
    html: `<div style="height:${size}px;width:${size}px;border-radius:9999px;background:white;border:4px solid ${active ? "#2563eb" : "#111827"};box-shadow:0 4px 14px rgba(0,0,0,.35)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function draftIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="height:24px;width:24px;border-radius:9999px;background:#fbbf24;border:3px solid #92400e;box-shadow:0 4px 14px rgba(0,0,0,.35)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function FullscreenGeometryMap({ open, onOpenChange, geometries, onSave, typeLibrary, only }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const drawGroupRef = useRef<L.LayerGroup | null>(null);
  const initialFitRef = useRef(false);

  const [localGeoms, setLocalGeoms] = useState<SurveyGeometry[]>(geometries);
  const [mode, setMode] = useState<GeometryKind>(only ?? "point");
  const [layer, setLayer] = useState<keyof typeof LAYERS>("sat");
  const [draft, setDraft] = useState<DraftVertex[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Record<GeometryKind, string>>({ point: "Outro", line: "Outro", polygon: "Outro" });

  const modes = only ? [only] : (["point", "line", "polygon"] as GeometryKind[]);
  const selected = selectedId ? localGeoms.find((g) => g.id === selectedId) : undefined;
  const activeType = selectedTypes[mode] || "Outro";

  const mountMap = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node || !open || mapRef.current) return;
    const map = L.map(node, { center: [-15.78, -47.93], zoom: 5, zoomControl: false });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const cfg = LAYERS.sat;
    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 20 }).addTo(map);
    drawGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 80);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLocalGeoms(geometries);
    setDirty(false);
    setDraft([]);
    setSelectedId(null);
    initialFitRef.current = false;
  }, [open, geometries]);

  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        // Leaflet can throw while tearing down transient draggable markers during hot reloads.
      }
      mapRef.current = null;
      tileRef.current = null;
      drawGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    tileRef.current.remove();
    const cfg = LAYERS[layer];
    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: 20 }).addTo(map);
  }, [layer]);

  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCurrentLocation(next);
        if (!localGeoms.length) mapRef.current?.setView(next, 17);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [open, localGeoms.length]);

  const dataKey = useMemo(
    () => JSON.stringify({ localGeoms: localGeoms.map((g) => [g.id, g.kind, g.geojson, g.name, g.typeLabel, g.customName, g.area_m2, g.length_m]), draft, selectedId, currentLocation }),
    [localGeoms, draft, selectedId, currentLocation],
  );

  function replaceGeometries(updater: (current: SurveyGeometry[]) => SurveyGeometry[]) {
    setLocalGeoms((current) => updater(current));
    setDirty(true);
  }

  function replaceGeometry(id: string, updater: (g: SurveyGeometry) => SurveyGeometry) {
    replaceGeometries((current) => current.map((g) => (g.id === id ? updater(g) : g)));
  }

  function nextCode(kind: GeometryKind) {
    return `${MODE_META[kind].prefix}${localGeoms.filter((g) => g.kind === kind).length + 1}`;
  }

  function suggestedName(kind: GeometryKind, typeLabel: string) {
    if (!typeLabel || typeLabel === "Outro") return "";
    const total = localGeoms.filter((g) => g.kind === kind && (g.typeLabel === typeLabel || g.name.startsWith(typeLabel))).length;
    return total > 0 ? `${typeLabel} ${total + 1}` : typeLabel;
  }

  function createGeometry(kind: GeometryKind, coords: [number, number][]) {
    const code = nextCode(kind);
    const typeLabel = activeType;
    const base: SurveyGeometry = {
      id: newGeometryId(),
      kind,
      code,
      typeLabel,
      name: suggestedName(kind, typeLabel),
      geojson: { type: "Point", coordinates: coords[0] },
      created_at: new Date().toISOString(),
      area_m2: null,
      length_m: null,
    };
    return geometryWithCoords(base, coords);
  }

  function addMapPoint(lat: number, lng: number) {
    replaceGeometries((current) => [...current, createGeometry("point", [[lng, lat]])]);
  }

  function addVertex(lat: number, lng: number) {
    const selectedGeom = selectedId ? localGeoms.find((g) => g.id === selectedId) : undefined;
    if (selectedGeom && selectedGeom.kind === mode && mode !== "point" && draft.length === 0) {
      replaceGeometry(selectedGeom.id, (g) => geometryWithCoords(g, [...coordsOf(g), [lng, lat]]));
      return;
    }
    setDraft((current) => [...current, { lat, lng, number: current.length + 1 }]);
    setDirty(true);
  }

  function finishDraft() {
    if (mode === "line" && draft.length < 2) return;
    if (mode === "polygon" && draft.length < 3) return;
    const coords = draft.map((v) => [v.lng, v.lat] as [number, number]);
    const next = createGeometry(mode, coords);
    replaceGeometries((current) => [...current, next]);
    setSelectedId(next.id);
    setDraft([]);
  }

  function removeSelected() {
    if (!selectedId) return;
    replaceGeometries((current) => current.filter((g) => g.id !== selectedId));
    setSelectedId(null);
  }

  function removeLastVertex() {
    if (draft.length > 0) {
      setDraft((current) => current.slice(0, -1).map((v, index) => ({ ...v, number: index + 1 })));
      setDirty(true);
      return;
    }
    if (!selected || selected.kind === "point") return;
    const min = selected.kind === "polygon" ? 3 : 2;
    const coords = coordsOf(selected);
    if (coords.length <= min) return;
    replaceGeometry(selected.id, (g) => geometryWithCoords(g, coords.slice(0, -1)));
  }

  function focusGeometry(g: SurveyGeometry) {
    const map = mapRef.current;
    if (!map) return;
    const pts = coordsOf(g).map(([lng, lat]) => [lat, lng] as [number, number]);
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 18);
    else map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 18 });
    setSelectedId(g.id);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
      setCurrentLocation(next);
      mapRef.current?.setView(next, 18);
    }, undefined, { enableHighAccuracy: true, timeout: 8000 });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      if (mode === "point") addMapPoint(lat, lng);
      else addVertex(lat, lng);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  });

  useEffect(() => {
    const map = mapRef.current;
    const group = drawGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const allPts: [number, number][] = [];

    if (currentLocation) {
      L.circleMarker(currentLocation, { radius: 7, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 })
        .bindTooltip("Voce esta aqui", { direction: "top" })
        .addTo(group);
      allPts.push(currentLocation);
    }

    localGeoms.forEach((g) => {
      const idx = localGeoms.filter((entry) => entry.kind === g.kind).findIndex((entry) => entry.id === g.id);
      const title = titleFor(g, idx);
      const details = summaryFor(g);
      const meta = MODE_META[g.kind];
      const popup = `<b>${escapeHtml(title)}</b>${details ? `<br/>${escapeHtml(details)}` : ""}${g.description ? `<br/>${escapeHtml(g.description)}` : ""}`;
      const tooltip = `${escapeHtml(title)}${details ? `<br/><small>${escapeHtml(details)}</small>` : ""}`;
      const positions = coordsOf(g).map(([lng, lat]) => [lat, lng] as [number, number]);
      if (!positions.length) return;
      positions.forEach((p) => allPts.push(p));

      if (g.kind === "point") {
        const pointLayer = selectedId === g.id
          ? L.marker(positions[0], { draggable: true, icon: vertexIcon(true), keyboard: false, autoPanOnFocus: false })
          : L.circleMarker(positions[0], {
              radius: 9,
              color: meta.color,
              fillColor: meta.fill,
              fillOpacity: 0.95,
              weight: 3,
            });
        pointLayer.addTo(group);
        pointLayer.bindPopup(popup);
        pointLayer.bindTooltip(tooltip, { direction: "top", offset: [0, -28], permanent: selectedId === g.id });
        pointLayer.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          setSelectedId(g.id);
          setMode("point");
        });
        if (pointLayer instanceof L.Marker) {
          pointLayer.on("dragend", () => {
            const p = pointLayer.getLatLng();
            replaceGeometry(g.id, (current) => geometryWithCoords(current, [[p.lng, p.lat]]));
          });
        }
        return;
      }

      const shape = g.kind === "line"
        ? L.polyline(positions, { color: meta.color, weight: selectedId === g.id ? 6 : 4 })
        : L.polygon(positions, { color: meta.color, weight: selectedId === g.id ? 4 : 2, fillColor: meta.fill, fillOpacity: 0.25 });
      shape.bindPopup(popup);
      shape.bindTooltip(tooltip, { sticky: true });
      shape.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        setSelectedId(g.id);
        setMode(g.kind);
      });
      shape.addTo(group);

      if (selectedId === g.id) {
        positions.forEach((pos, vertexIndex) => {
          const marker = L.marker(pos, { draggable: true, icon: vertexIcon(true), keyboard: false, autoPanOnFocus: false }).addTo(group);
          marker.bindTooltip(`Vertice ${vertexIndex + 1}`, { direction: "top" });
          marker.on("click", (event) => L.DomEvent.stopPropagation(event));
          marker.on("drag", () => {
            const p = marker.getLatLng();
            const coords = coordsOf(g);
            coords[vertexIndex] = [p.lng, p.lat];
            replaceGeometry(g.id, (current) => geometryWithCoords(current, coords));
          });
        });
      }
    });

    if (draft.length > 0) {
      const positions = draft.map((v) => [v.lat, v.lng] as [number, number]);
      positions.forEach((pos, index) => {
        L.marker(pos, { icon: draftIcon(), keyboard: false, autoPanOnFocus: false }).bindTooltip(`P${index + 1}`, { direction: "top" }).addTo(group);
        allPts.push(pos);
      });
      if (positions.length >= 2) {
        const meta = MODE_META[mode];
        if (mode === "polygon") L.polygon(positions, { color: meta.color, weight: 3, fillColor: meta.fill, fillOpacity: 0.18, dashArray: "6 6" }).addTo(group);
        else L.polyline(positions, { color: meta.color, weight: 4, dashArray: "6 6" }).addTo(group);
      }
    }

    if (!initialFitRef.current && allPts.length) {
      initialFitRef.current = true;
      setTimeout(() => {
        map.invalidateSize();
        if (allPts.length === 1) map.setView(allPts[0], 17);
        else map.fitBounds(L.latLngBounds(allPts), { padding: [50, 50], maxZoom: 18 });
      }, 120);
    }
  }, [dataKey]);

  function requestClose() {
    if (dirty) {
      setClosePrompt(true);
      return;
    }
    onOpenChange(false);
  }

  function saveAndClose() {
    onSave(localGeoms);
    setDirty(false);
    setClosePrompt(false);
    onOpenChange(false);
  }

  const counts = {
    point: localGeoms.filter((g) => g.kind === "point").length,
    line: localGeoms.filter((g) => g.kind === "line").length,
    polygon: localGeoms.filter((g) => g.kind === "polygon").length,
  };
  const selectedMeasure = selected ? summaryFor(selected) : "";
  const draftMeasure = draft.length > 1
    ? mode === "polygon" && draft.length > 2
      ? `${formatArea(polygonAreaMeters(draft.map((v) => [v.lng, v.lat] as [number, number])))} - ${formatLength(lineLengthMeters([...draft.map((v) => [v.lng, v.lat] as [number, number]), [draft[0].lng, draft[0].lat]]))}`
      : formatLength(lineLengthMeters(draft.map((v) => [v.lng, v.lat] as [number, number])))
    : "";

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
      <DialogContent className="left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 border-0 p-0 sm:rounded-none">
        <DialogTitle className="sr-only">Mapa de geometrias</DialogTitle>
        <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
          <div ref={mountMap} className="h-full w-full" />

          <div className="absolute left-3 right-3 top-3 z-[1000] flex items-start justify-between gap-2">
            <div className="min-w-0 rounded-lg border bg-background/95 p-2 shadow-lg backdrop-blur">
              <div className="text-xs font-semibold">Mapa de geometrias</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Toque no mapa para adicionar. Toque em um item para editar.
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="secondary" className="h-9 w-9 p-0 shadow-lg" onClick={locateMe} title="Ir para minha localizacao">
                <LocateFixed className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="secondary" className="h-9 w-9 p-0 shadow-lg" onClick={requestClose} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="absolute left-3 top-24 z-[1000] flex flex-col gap-1 rounded-lg border bg-background/95 p-1 shadow-lg backdrop-blur">
            {modes.map((kind) => {
              const meta = MODE_META[kind];
              const Icon = meta.icon;
              const active = mode === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (draft.length && kind !== mode && !confirm("Descartar desenho atual?")) return;
                    if (kind !== mode) setDraft([]);
                    setMode(kind);
                  }}
                  className={cn("flex h-11 w-11 items-center justify-center rounded-md transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                  title={meta.label}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>

          <div className="absolute right-3 top-24 z-[1000] flex overflow-hidden rounded-lg border bg-background/95 text-xs shadow-lg backdrop-blur">
            {(Object.keys(LAYERS) as (keyof typeof LAYERS)[]).map((key) => (
              <button
                key={key}
                type="button"
                className={cn("px-3 py-2", layer === key ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                onClick={() => setLayer(key)}
              >
                {LAYERS[key].label}
              </button>
            ))}
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-[1000] max-h-[58dvh] overflow-y-auto border-t bg-background/95 p-3 shadow-[0_-10px_35px_rgba(0,0,0,.18)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setPanelOpen((value) => !value)} className="flex min-w-0 items-center gap-2 text-left">
                <Layers className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Elementos no mapa</div>
                  <div className="text-xs text-muted-foreground">
                    {counts.point} ponto(s) - {counts.line} linha(s) - {counts.polygon} poligono(s)
                  </div>
                </div>
                {panelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
              <div className="flex shrink-0 gap-1">
                <Button variant="outline" size="sm" className="h-9 px-2" onClick={() => setDraft([])} disabled={!draft.length}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="sm" className="h-9 px-3" onClick={saveAndClose}>
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
            </div>

            {panelOpen && (
              <div className="space-y-3">
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {(typeLibrary[mode] ?? ["Outro"]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedTypes((current) => ({ ...current, [mode]: type }))}
                      className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs", activeType === type ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {(mode === "line" || mode === "polygon") && (
                  <div className="rounded-lg border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {draft.length ? `Desenho em andamento - ${draft.length} vertice(s)` : selected ? `Editando ${titleFor(selected, localGeoms.filter((g) => g.kind === selected.kind).findIndex((g) => g.id === selected.id))}` : "Toque no mapa para iniciar"}
                        </div>
                        {(draftMeasure || selectedMeasure) && <div className="text-muted-foreground">{draftMeasure || selectedMeasure}</div>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="outline" size="sm" className="h-8 px-2" onClick={removeLastVertex} disabled={!draft.length && !selected}>
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" className="h-8 px-2" onClick={finishDraft} disabled={mode === "line" ? draft.length < 2 : draft.length < 3}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Finalizar
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {selected && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold break-words">{titleFor(selected, localGeoms.filter((g) => g.kind === selected.kind).findIndex((g) => g.id === selected.id))}</div>
                        {selectedMeasure && <div className="text-muted-foreground">{selectedMeasure}</div>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive" onClick={removeSelected}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-1.5">
                  {localGeoms.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                      Nenhuma geometria no mapa ainda.
                    </div>
                  ) : (
                    localGeoms.map((g) => {
                      const index = localGeoms.filter((entry) => entry.kind === g.kind).findIndex((entry) => entry.id === g.id);
                      const meta = MODE_META[g.kind];
                      const Icon = meta.icon;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => focusGeometry(g)}
                          className={cn("flex items-center gap-2 rounded-lg border p-2 text-left text-xs", selectedId === g.id ? "border-primary bg-primary/5" : "border-border bg-background")}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${meta.fill}33`, color: meta.color }}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium break-words">{titleFor(g, index)}</span>
                            <span className="block text-muted-foreground break-words">{summaryFor(g) || "Sem medida"}</span>
                          </span>
                          <Crosshair className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {closePrompt && (
            <div className="absolute inset-0 z-[1200] grid place-items-center bg-black/55 p-4">
              <div className="w-full max-w-sm rounded-lg bg-background p-4 shadow-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-semibold">Existem alteracoes nao salvas.</div>
                    <div className="mt-1 text-sm text-muted-foreground">Deseja sair sem salvar ou salvar antes de voltar ao levantamento?</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <Button onClick={saveAndClose}>Salvar e sair</Button>
                  <Button variant="outline" onClick={() => { setClosePrompt(false); setDirty(false); onOpenChange(false); }}>Sair sem salvar</Button>
                  <Button variant="ghost" onClick={() => setClosePrompt(false)}>Cancelar</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
