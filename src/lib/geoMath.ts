/**
 * Cálculos geográficos simples para o módulo de geometria do Diário.
 * Coordenadas usadas como [lng, lat] (formato GeoJSON).
 */

const EARTH_RADIUS_M = 6378137;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Comprimento total de uma polilinha (m) usando Haversine entre vértices consecutivos. */
export function lineLengthMeters(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
  }
  return total;
}

/**
 * Área de polígono (m²) usando fórmula esférica (aproximação para áreas pequenas
 * suficiente para o uso agrícola). Coords no formato [lng, lat], pode ou não estar fechado.
 */
export function polygonAreaMeters(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  const ring = coords.slice();
  // garante anel fechado
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);

  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    total +=
      toRad(lng2 - lng1) *
      (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${Math.round(m2)} m²`;
}

export function formatLength(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}
