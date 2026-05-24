export type GeometryKind = "point" | "line" | "polygon";

export interface SurveyGeometry {
  id: string;
  kind: GeometryKind;
  /** Fixed field ID shown to the user, such as P1, L1 or A1. */
  code?: string;
  /** Standard library type chosen during capture, such as Poco or Linha de drenagem. */
  typeLabel?: string;
  /** Optional user label added after capture, without replacing the fixed code/type label. */
  customName?: string;
  name: string;
  description?: string;
  /** GeoJSON Geometry object: Point | LineString | Polygon (coords [lng,lat]) */
  geojson: any;
  area_m2?: number | null;
  length_m?: number | null;
  accuracy?: number | null;
  precision_quality?: "excelente" | "boa" | "aceitavel" | "baixa" | null;
  captured_at?: string;
  created_at: string;
}

export function newGeometryId() {
  return `geo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
