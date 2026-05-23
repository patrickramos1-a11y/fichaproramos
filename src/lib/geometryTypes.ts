export type GeometryKind = "point" | "line" | "polygon";

export interface SurveyGeometry {
  id: string;
  kind: GeometryKind;
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