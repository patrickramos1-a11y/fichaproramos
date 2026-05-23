import JSZip from "jszip";
import type { SurveyGeometry } from "./geometryTypes";

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const QUALITY_LABEL: Record<string, string> = {
  excelente: "Excelente",
  boa: "Boa",
  aceitavel: "Aceitável",
  baixa: "Baixa",
};

function placemarkXml(g: SurveyGeometry): string {
  const name = escapeXml(g.name || (g.kind === "polygon" ? "Polígono" : g.kind === "line" ? "Linha" : "Ponto"));
  const descParts: string[] = [];
  if (g.description) descParts.push(g.description);
  if (g.area_m2 != null) descParts.push(`Área: ${Math.round(g.area_m2)} m² (${(g.area_m2 / 10000).toFixed(3)} ha)`);
  if (g.length_m != null) descParts.push(`Comprimento: ${Math.round(g.length_m)} m`);
  if (g.accuracy != null) descParts.push(`Precisão: ~${Math.round(g.accuracy)} m`);
  if (g.precision_quality) descParts.push(`Qualidade: ${QUALITY_LABEL[g.precision_quality] || g.precision_quality}`);
  if (g.captured_at) descParts.push(`Capturado em: ${new Date(g.captured_at).toLocaleString("pt-BR")}`);
  const desc = escapeXml(descParts.join("\n"));

  let geomXml = "";
  if (g.kind === "point" && Array.isArray(g.geojson?.coordinates)) {
    const [lng, lat] = g.geojson.coordinates;
    geomXml = `<Point><coordinates>${lng},${lat},0</coordinates></Point>`;
  } else if (g.kind === "line" && Array.isArray(g.geojson?.coordinates)) {
    const coords = g.geojson.coordinates.map((c: number[]) => `${c[0]},${c[1]},0`).join(" ");
    geomXml = `<LineString><coordinates>${coords}</coordinates></LineString>`;
  } else if (g.kind === "polygon" && Array.isArray(g.geojson?.coordinates?.[0])) {
    const ring = g.geojson.coordinates[0];
    const closed =
      ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])
        ? [...ring, ring[0]]
        : ring;
    const coords = closed.map((c: number[]) => `${c[0]},${c[1]},0`).join(" ");
    geomXml = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  }

  return `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      ${geomXml}
    </Placemark>`;
}

export function buildKml(docName: string, geometries: SurveyGeometry[]): string {
  const placemarks = geometries.map(placemarkXml).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(docName)}</name>
${placemarks}
  </Document>
</kml>`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safe = (s: string) => (s || "geometrias").replace(/[^a-z0-9-_]+/gi, "_");

export function downloadKml(docName: string, geometries: SurveyGeometry[]) {
  const kml = buildKml(docName, geometries);
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  triggerDownload(blob, `${safe(docName)}.kml`);
}

export async function downloadKmz(docName: string, geometries: SurveyGeometry[]) {
  const kml = buildKml(docName, geometries);
  const zip = new JSZip();
  zip.file("doc.kml", kml);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" });
  triggerDownload(blob, `${safe(docName)}.kmz`);
}

export function downloadSingleKml(g: SurveyGeometry) {
  downloadKml(g.name || g.kind, [g]);
}