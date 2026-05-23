import type { SurveyReport, ReportRow, ReportModule } from "./reportBuilder";

function rowsToMd(rows: ReportRow[]): string {
  if (!rows.length) return "_(sem campos)_";
  const lines: string[] = ["| Campo | Valor | Observação |", "|---|---|---|"];
  for (const r of rows) {
    const v = r.filled ? r.value.replace(/\|/g, "\\|") : "—";
    const n = (r.note ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${r.label} | ${v} | ${n} |`);
    if (r.subRows?.length) {
      for (const s of r.subRows) {
        lines.push(`| _${s.title}_ | | |`);
        for (const sr of s.rows) {
          const sv = sr.filled ? sr.value.replace(/\|/g, "\\|") : "—";
          lines.push(`| &nbsp;&nbsp;${sr.label} | ${sv} | |`);
        }
      }
    }
  }
  return lines.join("\n");
}

function moduleToMd(m: ReportModule): string {
  const out: string[] = [];
  out.push(`### ${m.title}`);
  out.push(`**Status:** ${m.status} · **Preenchimento:** ${m.filled}/${m.total}`);
  out.push("");
  out.push(m.paragraph);
  if (m.topRows.length) {
    out.push("");
    out.push(rowsToMd(m.topRows));
  }
  for (const sg of m.subgroups) {
    out.push("");
    out.push(`#### ${sg.title} (${sg.filled}/${sg.total} — ${sg.status})`);
    if (sg.description) out.push(`_${sg.description}_`);
    out.push(rowsToMd(sg.rows));
    if (sg.note) out.push(`> ${sg.note}`);
  }
  if (m.pendencias.length) {
    out.push("");
    out.push("**Pendências do módulo:**");
    for (const p of m.pendencias) out.push(`- ${p.description}${p.responsible ? ` — ${p.responsible}` : ""}`);
  }
  if (m.attachments.length) {
    out.push("");
    out.push(`**Anexos:** ${m.attachments.length} arquivo(s)`);
  }
  if (m.notes) {
    out.push("");
    out.push(`> ${m.notes}`);
  }
  return out.join("\n");
}

export function toMarkdown(r: SurveyReport): string {
  const out: string[] = [];
  const h = r.header;
  out.push(`# ${h.title}`);
  out.push("");
  out.push(`**Cliente:** ${h.clientName}${h.projectName ? ` · ${h.projectName}` : ""}`);
  out.push(`**Tipo:** ${h.typeLabel}`);
  if (h.purposes.length) out.push(`**Finalidades:** ${h.purposes.join(", ")}`);
  out.push(`**Status:** ${h.statusLabel}${h.closedAt ? ` (${h.closedAt})` : ""}`);
  if (h.date) out.push(`**Data:** ${h.date}`);
  if (h.responsavel) out.push(`**Responsável:** ${h.responsavel}`);
  if (h.realizadoPor) out.push(`**Realizado por:** ${h.realizadoPor}`);
  out.push(`**Indicadores:** ${h.counters.modules} módulos · ${h.counters.filledFields}/${h.counters.totalFields} campos · ${h.counters.pendencias} pendências · ${h.counters.photos} fotos · ${h.counters.docs} docs`);

  out.push("\n## Resumo executivo\n");
  out.push(r.executiveSummary);
  out.push("\n## Finalidades\n");
  out.push(r.purposeSection);

  if (r.clientSection) {
    out.push("\n## Dados do cliente\n");
    out.push(r.clientSection.paragraph);
    out.push("");
    out.push(rowsToMd(r.clientSection.rows));
  }
  if (r.visitSection) {
    out.push("\n## Contexto da visita\n");
    out.push(r.visitSection.paragraph);
    out.push("");
    out.push(rowsToMd(r.visitSection.rows));
  }

  out.push("\n## Desenvolvimento por módulo\n");
  for (const m of r.modules) out.push("\n" + moduleToMd(m));

  out.push("\n## Pendências\n");
  out.push(r.pendencias.paragraph);
  if (r.pendencias.items.length) {
    out.push("");
    out.push("| Pendência | Módulo | Responsável | Status |");
    out.push("|---|---|---|---|");
    for (const p of r.pendencias.items) {
      out.push(`| ${p.description} | ${p.module} | ${p.responsible ?? "—"} | ${p.status} |`);
    }
  }

  out.push("\n## Fotos e documentos\n");
  out.push(`Fotos: ${r.attachments.photos.length} · Documentos: ${r.attachments.docs.length} · Áudios: ${r.attachments.audios.length}`);
  if (r.attachments.docs.length) {
    out.push("");
    for (const d of r.attachments.docs) out.push(`- ${d.att.name} _(${d.moduleTitle})_`);
  }

  if (r.observations.length) {
    out.push("\n## Observações técnicas\n");
    for (const o of r.observations) out.push(`- **${o.moduleTitle} — ${o.scope}:** ${o.text}`);
  }

  out.push("\n## Encerramento\n");
  out.push(r.closing.paragraph);
  return out.join("\n");
}

export function toPlainText(r: SurveyReport): string {
  return toMarkdown(r)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\|/g, " ")
    .replace(/^>\s*/gm, "");
}

function blockRows(rows: ReportRow[], indent = ""): string {
  return rows.map((r) => {
    const v = r.filled ? r.value : "—";
    const note = r.note ? ` // obs: ${r.note}` : "";
    let s = `${indent}- ${r.label}: ${v}${note}`;
    if (r.subRows?.length) {
      for (const sr of r.subRows) {
        s += `\n${indent}  · ${sr.title}\n` + blockRows(sr.rows, indent + "    ");
      }
    }
    return s;
  }).join("\n");
}

export function toAIPrompt(r: SurveyReport): string {
  const out: string[] = [];
  const h = r.header;
  out.push("LEVANTAMENTO:");
  out.push(`- Título: ${h.title}`);
  out.push(`- Cliente: ${h.clientName}`);
  out.push(`- Tipo: ${h.typeLabel}`);
  out.push(`- Status: ${h.statusLabel}${h.closedAt ? ` (${h.closedAt})` : ""}`);
  if (h.date) out.push(`- Data: ${h.date}`);
  if (h.responsavel) out.push(`- Responsável: ${h.responsavel}`);
  if (h.realizadoPor) out.push(`- Realizado por: ${h.realizadoPor}`);
  out.push(`- Indicadores: ${h.counters.filledFields}/${h.counters.totalFields} campos, ${h.counters.pendencias} pendências, ${h.counters.photos} fotos, ${h.counters.docs} docs`);

  out.push("\nFINALIDADES:");
  out.push(h.purposes.length ? h.purposes.map((p) => `- ${p}`).join("\n") : "- (não definidas)");

  out.push("\nRESUMO:");
  out.push(r.executiveSummary);

  if (r.clientSection) {
    out.push("\nCLIENTE:");
    out.push(blockRows(r.clientSection.rows));
  }
  if (r.visitSection) {
    out.push("\nVISITA:");
    out.push(blockRows(r.visitSection.rows));
  }

  out.push("\nMÓDULOS:");
  for (const m of r.modules) {
    out.push(`\n# ${m.title} [${m.status} · ${m.filled}/${m.total}]`);
    out.push(m.paragraph);
    if (m.topRows.length) out.push(blockRows(m.topRows));
    for (const sg of m.subgroups) {
      out.push(`  ## ${sg.title} (${sg.filled}/${sg.total} — ${sg.status})`);
      out.push(blockRows(sg.rows, "  "));
      if (sg.note) out.push(`  > obs: ${sg.note}`);
    }
    if (m.notes) out.push(`> obs: ${m.notes}`);
  }

  out.push("\nPENDÊNCIAS:");
  if (r.pendencias.items.length === 0) {
    out.push("- (nenhuma)");
  } else {
    for (const p of r.pendencias.items) {
      out.push(`- [${p.status}] ${p.description}${p.responsible ? ` — ${p.responsible}` : ""} (módulo ${p.module})`);
    }
  }

  out.push("\nANEXOS:");
  out.push(`- Fotos: ${r.attachments.photos.length}`);
  out.push(`- Documentos: ${r.attachments.docs.length}`);
  out.push(`- Áudios: ${r.attachments.audios.length}`);
  for (const d of r.attachments.docs) out.push(`  · ${d.att.name} (${d.moduleTitle})`);

  out.push("\nOBSERVAÇÕES:");
  if (r.observations.length === 0) out.push("- (nenhuma)");
  for (const o of r.observations) out.push(`- ${o.moduleTitle} — ${o.scope}: ${o.text}`);

  out.push("\nENCERRAMENTO:");
  out.push(r.closing.paragraph);

  return out.join("\n");
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
